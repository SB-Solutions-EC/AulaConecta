package ec.sbsolutions.aulaconecta.identidad.seguridad;

import com.nimbusds.jose.jwk.JWKSet;
import ec.sbsolutions.aulaconecta.identidad.autenticacion.PropiedadesBloqueo;
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
@EnableConfigurationProperties({PropiedadesJwt.class, PropiedadesBloqueo.class})
public class ConfiguracionSeguridad {

    // Parámetros mínimos recomendados por OWASP para Argon2id: 19 MiB de memoria, 2 iteraciones, 1 hilo
    private static final int ARGON2_MEMORIA_KIB = 19_456;
    private static final int ARGON2_ITERACIONES = 2;

    @Bean
    SecurityFilterChain cadenaDeSeguridad(HttpSecurity http) throws Exception {
        AuthorizationManager<RequestAuthorizationContext> sinClaveInicial = ConfiguracionSeguridad::sinClaveInicial;
        AuthorizationManager<RequestAuthorizationContext> administrador = AuthorizationManagers.allOf(
                AuthorityAuthorizationManager.hasRole(CodigoRol.ADMIN.name()), sinClaveInicial);
        http
                // API sin sesión ni cookies de autenticación: cada petición trae su token bearer
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sesion -> sesion.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(peticiones -> peticiones
                        .requestMatchers(HttpMethod.GET, "/health", "/.well-known/jwks.json").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                        .requestMatchers("/error").permitAll()
                        // Con la clave inicial solo se puede consultar la sesión y cambiar la clave (RF-03)
                        .requestMatchers(HttpMethod.GET, "/auth/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/auth/cambiar-clave").authenticated()
                        // Gestión de cuentas y bitácora: solo el administrador (el token de servicio llega en T1110-A)
                        .requestMatchers(HttpMethod.POST, "/usuarios", "/usuarios/*/desbloquear").access(administrador)
                        .requestMatchers(HttpMethod.GET, "/auditoria-accesos").access(administrador)
                        .anyRequest().access(sinClaveInicial))
                .oauth2ResourceServer(servidor -> servidor.jwt(jwt -> jwt.jwtAuthenticationConverter(convertidorDeRoles())));
        return http.build();
    }

    static AuthorizationDecision sinClaveInicial(Supplier<? extends Authentication> autenticacion,
            RequestAuthorizationContext contexto) {
        return new AuthorizationDecision(autenticacion.get() instanceof JwtAuthenticationToken token
                && token.isAuthenticated()
                && !Boolean.TRUE.equals(token.getToken().getClaimAsBoolean(EmisorTokens.RECLAMO_CAMBIO_CLAVE)));
    }

    private static JwtAuthenticationConverter convertidorDeRoles() {
        JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName(EmisorTokens.RECLAMO_ROLES);
        roles.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter convertidor = new JwtAuthenticationConverter();
        convertidor.setJwtGrantedAuthoritiesConverter(roles);
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
