import { createServer, IncomingMessage, ServerResponse } from 'node:http';

const puerto = Number(process.env.PORT ?? 3000);

export function manejarPeticion(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'UP' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ status: 'NOT_FOUND' }));
}

if (require.main === module) {
  const servidor = createServer(manejarPeticion);
  servidor.listen(puerto, '0.0.0.0', () => {
    process.stdout.write(`ms-academico activo en puerto ${puerto}\n`);
  });
}

