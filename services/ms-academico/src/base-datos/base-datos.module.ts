import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Acceso a db_academico para todos los módulos (Prisma Migrate, T1028-M). */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class BaseDatosModule {}
