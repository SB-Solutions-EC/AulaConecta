import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PantallaTareas } from './PantallaTareas';

describe('PantallaTareas (RF-19: Docente y Estudiante)', () => {
  it('permite al docente validar, publicar una actividad y calificar una entrega', async () => {
    render(<PantallaTareas rolActivo="DOCENTE" nombreUsuario="carlos.docente" omitirCargaRemota />);

    expect(screen.getByTestId('vista-tareas-docente')).toBeInTheDocument();

    // Validación de título vacío
    fireEvent.click(screen.getByTestId('boton-publicar-tarea'));
    expect(screen.getByTestId('aviso-error-tareas')).toHaveTextContent(
      /Ingresa un título/i,
    );

    // Publicar proyecto nuevo
    fireEvent.change(screen.getByTestId('input-titulo-tarea'), {
      target: { value: 'Maqueta de geometría' },
    });
    fireEvent.change(screen.getByTestId('select-tipo-tarea'), {
      target: { value: 'PROYECTO' },
    });
    fireEvent.change(screen.getByTestId('input-descripcion-tarea'), {
      target: { value: 'Construir cuerpos geométricos con medidas reales.' },
    });
    fireEvent.click(screen.getByTestId('boton-publicar-tarea'));

    await waitFor(() => {
      expect(screen.getByText('Maqueta de geometría')).toBeInTheDocument();
      expect(screen.getByTestId('aviso-exito-tareas')).toHaveTextContent(
        /publicada correctamente/i,
      );
    });

    // Abrir entregas de la tarea inicial 1 y calificar
    fireEvent.click(screen.getByTestId('boton-ver-entregas-tar-demo-1'));
    expect(screen.getByTestId('modal-entregas-docente')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-nota-entrega-ent-demo-1'), {
      target: { value: '9.5' },
    });
    fireEvent.change(
      screen.getByTestId('input-observacion-entrega-ent-demo-1'),
      {
        target: { value: 'Excelente procedimiento' },
      },
    );
    fireEvent.click(screen.getByTestId('boton-calificar-entrega-ent-demo-1'));

    await waitFor(() => {
      expect(screen.getByTestId('aviso-exito-tareas')).toHaveTextContent(
        /calificada con 9\.50/i,
      );
    });
  });

  it('permite al estudiante filtrar actividades y enviar una entrega', async () => {
    render(
      <PantallaTareas
        rolActivo="ESTUDIANTE"
        nombreUsuario="ana.perez"
        omitirCargaRemota
      />,
    );

    expect(screen.getByTestId('vista-tareas-estudiante')).toBeInTheDocument();
    expect(screen.getByTestId('estado-entrega-tar-demo-1')).toHaveTextContent(
      'Pendiente',
    );
    expect(screen.getByTestId('estado-entrega-tar-demo-3')).toHaveTextContent(
      /Calificada · 9\.25 \/ 10/,
    );

    // Abrir entrega de tarea pendiente
    fireEvent.click(screen.getByTestId('boton-abrir-entrega-tar-demo-1'));
    expect(screen.getByTestId('modal-entrega-estudiante')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-comentario-entrega'), {
      target: { value: 'Envío los 10 ejercicios resueltos.' },
    });
    fireEvent.change(screen.getByTestId('input-enlace-entrega'), {
      target: { value: 'https://aulaconecta.local/ana-taller-1.pdf' },
    });
    fireEvent.click(screen.getByTestId('boton-confirmar-entrega'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('modal-entrega-estudiante'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('estado-entrega-tar-demo-1')).toHaveTextContent(
        'Entregada',
      );
    });
  });
});
