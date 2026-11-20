import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configurarSwagger } from './swagger';

async function iniciar(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const puerto = config.getOrThrow<number>('puerto');

  // No revelar la tecnología del servidor en las cabeceras.
  app.disable('x-powered-by');
  app.enableShutdownHooks();

  if (config.get<boolean>('swaggerHabilitado')) {
    configurarSwagger(app);
  }

  await app.listen(puerto);
  Logger.log(`ms-academico escuchando en el puerto ${puerto}`, 'Inicio');
}

void iniciar();
