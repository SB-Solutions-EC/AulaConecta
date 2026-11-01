import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { cargarConfiguracion } from './config/configuracion';
import { SaludController } from './salud/salud.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [cargarConfiguracion] })],
  controllers: [SaludController],
})
export class AppModule {}
