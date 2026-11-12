import { Module } from '@nestjs/common';
import { ClienteIdentidad } from './cliente-identidad';

/** Comunicación con ms-identidad. Los módulos que crean personas (docentes, matrícula) lo importan. */
@Module({
  providers: [ClienteIdentidad],
  exports: [ClienteIdentidad],
})
export class IdentidadModule {}
