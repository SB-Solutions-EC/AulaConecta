package ec.sbsolutions.aulaconecta.identidad.seguridad;

import com.nimbusds.jose.jwk.JWKSet;
import ec.sbsolutions.aulaconecta.identidad.autenticacion.PropiedadesBloqueo;
import ec.sbsolutions.aulaconecta.identidad.servicio.PropiedadesClientesServicio;
import ec.sbsolutions.aulaconecta.identidad.usuario.CodigoRol;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorityAuthorizationManager;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.authorization.AuthorizationManagers;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimNames;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;

@Configuration
@EnableConfigurationProperties({PropiedadesJwt.class, PropiedadesBloqueo.class, PropiedadesClientesServicio.class})
public class ConfiguracionSeguridad {

    // Parámetros mínimos recomendados por OWASP para Argon2id: 19 MiB de memoria, 2 iteraciones, 1 hilo
    private static final int ARGON2_MEMORIA_KIB = 19_456;
    private static final int ARGON2_ITERACIONES = 2;

    // Alcance que ms-academico necesita para dar de alta las cuentas de docentes y estudiantes (RF-05)
    static final String ALCANCE_CREAR_USUARIOS = "usuarios:crear";

    @Bean
    SecurityFilterChain cadenaDeSeguridad(HttpSecurity http) throws Exception {
        AuthorizationManager<RequestAuthorizationContext> usuario = (autenticacion, contexto) ->
                new AuthorizationDecision(esDeTipo(autenticacion.get(), EmisorTokens.TIPO_USUARIO));
        AuthorizationManager<RequestAuthorizationContext> sinClaveInicial = ConfiguracionSeguridad::sinClaveInicial;
        AuthorizationManager<RequestAuthorizationContext> administrador = AuthorizationManagers.allOf(
                AuthorityAuthorizationManager.hasRole(CodigoRol.ADMIN.name()), sinClaveInicial);
        AuthorizationManager<RequestAuthorizationContext> servicioQueCreaUsuarios = AuthorizationManagers.allOf(
                (autenticacion, contexto) -> new AuthorizationDecision(
                        esDeTipo(autenticacion.get(), EmisorTokens.TIPO_SERVICIO)),
                AuthorityAuthorizationManager.hasAuthority("SCOPE_" + ALCANCE_CREAR_USUARIOS));
        http
                // API sin sesión ni cookies de autenticación: cada petición trae su token bearer
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sesion -> sesion.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(peticiones -> peticiones
                        .requestMatchers(HttpMethod.GET, "/health", "/.well-known/jwks.json").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login", "/oauth/token").permitAll()
                        .requestMatchers("/error").permitAll()
                        // Con la clave inicial solo se puede consultar la sesión y cambiar la clave (RF-03).
                        // Un token de servicio no es una persona: aquí no sirve
                        .requestMatchers(HttpMethod.GET, "/auth/me").access(usuario)
                        .requestMatchers(HttpMethod.POST, "/auth/cambiar-clave").access(usuario)
                        // Altas: el administrador o un servicio con el alcance usuarios:crear (T1110-A)
                        .requestMatchers(HttpMethod.POST, "/usuarios")
                                .access(AuthorizationManagers.anyOf(administrador, servicioQueCreaUsuarios))
                        // Desbloqueo y bitácora: solo el administrador
                        .requestMatchers(HttpMethod.POST, "/usuarios/*/desbloquear").access(administrador)
                        .requestMatchers(HttpMethod.GET, "/auditoria-accesos").access(administrador)
                        .anyRequest().access(sinClaveInicial))
                .oauth2ResourceServer(servidor -> servidor.jwt(jwt -> jwt.jwtAuthenticationConverter(convertidorDeAutoridades())));
        return http.build();
    }

    /** Una persona (no un servicio) que ya cambió su clave inicial. */
    static AuthorizationDecision sinClaveInicial(Supplier<? extends Authentication> autenticacion,
            RequestAuthorizationContext contexto) {
        Authentication actual = autenticacion.get();
        return new AuthorizationDecision(esDeTipo(actual, EmisorTokens.TIPO_USUARIO)
                && !Boolean.TRUE.equals(((JwtAuthenticationToken) actual).getToken()
                        .getClaimAsBoolean(EmisorTokens.RECLAMO_CAMBIO_CLAVE)));
    }

    static boolean esDeTipo(Authentication autenticacion, String tipo) {
        return autenticacion instanceof JwtAuthenticationToken token
                && token.isAuthenticated()
                && tipo.equals(token.getToken().getClaimAsString(EmisorTokens.RECLAMO_TIPO));
    }

    /**
     * Roles (ROLE_) para los tokens de usuario y alcances (SCOPE_) para los de servicio, nunca los dos:
     * un token de usuario no puede traer alcances ni uno de servicio, roles.
     */
    private static JwtAuthenticationConverter convertidorDeAutoridades() {
        JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName(EmisorTokens.RECLAMO_ROLES);
        roles.setAuthorityPrefix("ROLE_");
        JwtGrantedAuthoritiesConverter alcances = new JwtGrantedAuthoritiesConverter();
        alcances.setAuthoritiesClaimName(EmisorTokens.RECLAMO_ALCANCE);
        alcances.setAuthorityPrefix("SCOPE_");
        JwtAuthenticationConverter convertidor = new JwtAuthenticationConverter();
        convertidor.setJwtGrantedAuthoritiesConverter(jwt ->
                EmisorTokens.TIPO_SERVICIO.equals(jwt.getClaimAsString(EmisorTokens.RECLAMO_TIPO))
                        ? alcances.convert(jwt)
                        : roles.convert(jwt));
        return convertidor;
    }

    @Bean
    JwtEncoder codificadorJwt(ClaveFirma clave) {
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(clave.jwk())));
    }

    /** Valida firma, vigencia, emisor y audiencia de los tokens propios. */
    @Bean
    JwtDecoder decodificadorJwt(ClaveFirma clave, PropiedadesJwt propiedades) {
        NimbusJwtDecoder decodificador = NimbusJwtDecoder.withPublicKey(clave.publica())
                .signatureAlgorithm(SignatureAlgorithm.RS256)
                .build();
        decodificador.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(propiedades.emisor()),
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                        audiencia -> audiencia != null && audiencia.contains(propiedades.audiencia()))));
        return decodificador;
    }

    /** Argon2id para las claves nuevas; también acepta BCrypt para claves heredadas y las migra al iniciar sesión. */
    @Bean
    PasswordEncoder codificadorClaves() {
        Map<String, PasswordEncoder> codificadores = Map.of(
                "argon2", new Argon2PasswordEncoder(16, 32, 1, ARGON2_MEMORIA_KIB, ARGON2_ITERACIONES),
                "bcrypt", new BCryptPasswordEncoder());
        return new DelegatingPasswordEncoder("argon2", codificadores);
    }
}
