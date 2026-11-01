import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configurarSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('AulaConecta · ms-academico')
    .setDescription('Año lectivo, cursos, materias, matrícula, calificaciones, asistencia y planificación.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const documento = SwaggerModule.createDocument(app, config);
  // Interfaz en /docs y contrato OpenAPI en /docs-json
  SwaggerModule.setup('docs', app, documento, { jsonDocumentUrl: 'docs-json' });
}
