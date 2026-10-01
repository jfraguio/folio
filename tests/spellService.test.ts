// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { SpellService } from '../src/spell/SpellService';

/** Worker simulado: registra los mensajes y deja dispararlos a mano. */
class FakeWorker {
  private listeners = new Map<string, Set<(ev: unknown) => void>>();
  posted: { id: number; type: string }[] = [];
  terminated = false;

  addEventListener(type: string, fn: (ev: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(): void {}
  postMessage(msg: { id: number; type: string }): void {
    this.posted.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(type: string, ev: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(ev);
  }
  last(): { id: number; type: string } {
    return this.posted[this.posted.length - 1]!;
  }
}

const make = () => {
  const worker = new FakeWorker();
  const service = new SpellService(() => worker as unknown as Worker);
  return { worker, service };
};

/** Responde al último mensaje como haría el worker real. */
const respond = (worker: FakeWorker, msg: Record<string, unknown>): void => {
  worker.emit('message', { data: { id: worker.last().id, ...msg } });
};

describe('SpellService', () => {
  it('pasa a ready al cargar y avisa a onReady', async () => {
    const { worker, service } = make();
    const ready = vi.fn();
    service.onReady(ready);
    const p = service.load();
    expect(service.state).toBe('loading');
    respond(worker, { type: 'loaded', lang: 'es' });
    await p;
    expect(service.state).toBe('ready');
    expect(service.ready).toBe(true);
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it('si la carga falla queda en failed y un load() posterior reintenta', async () => {
    const { worker, service } = make();
    const p1 = service.load();
    respond(worker, { type: 'error', message: 'sin red' });
    await expect(p1).rejects.toThrow('sin red');
    expect(service.state).toBe('failed');
    expect(service.ready).toBe(false);

    const p2 = service.load();
    respond(worker, { type: 'loaded', lang: 'es' });
    await p2;
    expect(service.state).toBe('ready');
  });

  it('un error del worker rechaza lo pendiente y permite reintentar', async () => {
    const { worker, service } = make();
    const p = service.load();
    worker.emit('error', { message: 'no cargó' });
    await expect(p).rejects.toThrow('no cargó');
    expect(service.state).toBe('failed');
    expect(worker.terminated).toBe(true);
  });

  it('dispose rechaza lo pendiente y vuelve a idle', async () => {
    const { service } = make();
    const p = service.load();
    service.dispose();
    await expect(p).rejects.toThrow('disposed');
    expect(service.state).toBe('idle');
  });

  it('check consulta las palabras desconocidas y las cachea', async () => {
    const { worker, service } = make();
    const p = service.load();
    respond(worker, { type: 'loaded', lang: 'es' });
    await p;

    const checking = service.check(['hola', 'oqneu']);
    expect(worker.last().type).toBe('check');
    respond(worker, { type: 'checked', results: [true, false] });
    const res = await checking;
    expect(res.get('hola')).toBe(true);
    expect(res.get('oqneu')).toBe(false);

    const postedBefore = worker.posted.length;
    const cached = await service.check(['hola']);
    expect(cached.get('hola')).toBe(true);
    expect(worker.posted.length).toBe(postedBefore); // no vuelve a preguntar
  });
});
