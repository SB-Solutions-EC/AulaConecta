import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generado/prisma/client';

/**
 * Cliente de db_academico. Prisma conecta en la primera consulta, así que el servicio
 * arranca aunque la base todavía no responda; /health no depende de ella.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly registro = new Logger('BaseDatos');

  constructor(config: ConfigService) {
    const url = config.get<string>('baseDatosUrl');
    super({ adapter: new PrismaPg({ connectionString: url ?? 'postgresql://sin-configurar@localhost:1/sin-configurar' }) });
    if (!url) {
      this.registro.warn('DATABASE_URL no está definida: las operaciones con la base fallarán.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
