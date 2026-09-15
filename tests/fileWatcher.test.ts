import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileWatcher } from '../src/persistence/fileWatcher';

function makeWatcher(opts: { canReload?: () => boolean; intervalMs?: number } = {}) {
  let disk = 1000;
  let known = 1000;
  const mtime = vi.fn(async () => disk);
  const onChange = vi.fn(async (m: number) => {
    known = m; // quien recarga actualiza lastKnownModified
  });
  const onError = vi.fn();
  const w = new FileWatcher({
    mtime,
    lastKnown: () => known,
    canReload: opts.canReload,
    onChange,
    onError,
    intervalMs: opts.intervalMs ?? 10_000,
  });
  return { w, mtime, onChange, onError, setDisk: (m: number) => (disk = m), getKnown: () => known };
}

describe('FileWatcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('no hace nada si el mtime coincide', async () => {
    const { w, mtime, onChange } = makeWatcher();
    expect(await w.check()).toBe(false);
    expect(mtime).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('recarga cuando el mtime del disco es posterior y actualiza lastKnown', async () => {
    const { w, onChange, setDisk, getKnown } = makeWatcher();
    setDisk(2000);
    expect(await w.check()).toBe(true);
    expect(onChange).toHaveBeenCalledWith(2000);
    expect(getKnown()).toBe(2000);
    // Ya sincronizado: la siguiente comprobación no vuelve a recargar.
    expect(await w.check()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('no recarga si el mtime del disco es anterior al conocido', async () => {
    const { w, mtime, onChange, setDisk, getKnown } = makeWatcher();
    setDisk(500);
    expect(await w.check()).toBe(false);
    expect(mtime).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
    expect(getKnown()).toBe(1000);
  });

  it('sondea cada intervalo mientras está arrancado y para al detenerlo', async () => {
    const { w, mtime, onChange, setDisk } = makeWatcher({ intervalMs: 10_000 });
    w.start();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(mtime).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(mtime).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();

    setDisk(3000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mtime).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);

    w.stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mtime).toHaveBeenCalledTimes(2);
  });

  it('start() es idempotente: no duplica el intervalo', async () => {
    const { w, mtime } = makeWatcher({ intervalMs: 1000 });
    w.start();
    w.start();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mtime).toHaveBeenCalledTimes(1);
  });

  it('no recarga si canReload devuelve false (escritura propia en vuelo) y lo hace al siguiente ciclo', async () => {
    let saving = true;
    const { w, onChange, setDisk } = makeWatcher({ canReload: () => !saving });
    setDisk(2000);
    expect(await w.check()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    // En cuanto termina la escritura, la siguiente comprobación sí recarga.
    saving = false;
    expect(await w.check()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('una sola comprobación en vuelo: las simultáneas se ignoran', async () => {
    let release!: (m: number) => void;
    const mtime = vi.fn(() => new Promise<number>((r) => (release = r)));
    const onChange = vi.fn();
    const w = new FileWatcher({ mtime, lastKnown: () => 1000, onChange });
    const first = w.check();
    const second = w.check(); // mientras la primera espera
    expect(await second).toBe(false);
    expect(mtime).toHaveBeenCalledTimes(1);
    release(2000);
    expect(await first).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('un fallo al consultar el mtime no recarga y se notifica por onError', async () => {
    const err = new DOMException('gone', 'NotFoundError');
    const mtime = vi.fn(async () => {
      throw err;
    });
    const onChange = vi.fn();
    const onError = vi.fn();
    const w = new FileWatcher({ mtime, lastKnown: () => 1000, onChange, onError });
    expect(await w.check()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('tras dispose() no sondea ni comprueba', async () => {
    const { w, mtime, setDisk } = makeWatcher({ intervalMs: 1000 });
    w.start();
    w.dispose();
    setDisk(2000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await w.check()).toBe(false);
    expect(mtime).not.toHaveBeenCalled();
  });
});
