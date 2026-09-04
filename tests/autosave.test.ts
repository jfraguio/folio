import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave, classifyError, type SaveState } from '../src/persistence/autosave';

function makeIO(opts: { mtime?: () => number; write?: (t: string) => Promise<void> } = {}) {
  let disk = 1000;
  const writes: string[] = [];
  const io = {
    mtime: vi.fn(async () => (opts.mtime ? opts.mtime() : disk)),
    write: vi.fn(async (t: string) => {
      if (opts.write) await opts.write(t);
      writes.push(t);
      disk += 1;
      return disk;
    }),
  };
  return { io, writes, setDisk: (m: number) => (disk = m), getDisk: () => disk };
}

describe('Autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('escribe una vez tras el debounce aunque haya varias ediciones', async () => {
    let text = 'a';
    const { io, writes } = makeIO();
    const states: SaveState[] = [];
    const a = new Autosave({ getText: () => text, io, initialMtime: 1000, debounceMs: 100, onState: (s) => states.push(s) });

    text = 'ab';
    a.markDirty();
    text = 'abc';
    a.markDirty();
    expect(a.state).toBe('dirty');

    await vi.advanceTimersByTimeAsync(150);
    expect(writes).toEqual(['abc']);
    expect(a.state).toBe('saved');
    expect(states).toEqual(['dirty', 'dirty', 'saving', 'saved']);
  });

  it('encadena una nueva escritura si hay cambios durante el guardado', async () => {
    let text = 'v1';
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { io, writes } = makeIO({
      write: async (t) => {
        if (t === 'v1') await gate;
      },
    });
    const a = new Autosave({ getText: () => text, io, initialMtime: 1000, debounceMs: 10 });

    a.markDirty();
    await vi.advanceTimersByTimeAsync(20);
    expect(a.state).toBe('saving');

    text = 'v2';
    a.markDirty(); // durante la escritura
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.state).toBe('dirty');
    await vi.advanceTimersByTimeAsync(20);
    expect(writes).toEqual(['v1', 'v2']);
    expect(a.state).toBe('saved');
  });

  it('detecta conflicto cuando el archivo cambió en el disco y no sobrescribe', async () => {
    const { io, writes, setDisk } = makeIO();
    const onConflict = vi.fn();
    const a = new Autosave({ getText: () => 'x', io, initialMtime: 1000, debounceMs: 10, onConflict });

    setDisk(5000); // Drive modificó el archivo
    a.markDirty();
    await vi.advanceTimersByTimeAsync(20);

    expect(writes).toEqual([]);
    expect(a.state).toBe('conflict');
    expect(onConflict).toHaveBeenCalledWith(5000);

    a.markDirty(); // en conflicto no se escribe
    await vi.advanceTimersByTimeAsync(20);
    expect(writes).toEqual([]);

    await a.overwrite(); // el usuario decide conservar la suya
    expect(writes).toEqual(['x']);
    expect(a.state).toBe('saved');
  });

  it('pasa a error con permiso denegado y no reintenta solo', async () => {
    const { io } = makeIO({
      write: async () => {
        throw new DOMException('denied', 'NotAllowedError');
      },
    });
    const onError = vi.fn();
    const a = new Autosave({ getText: () => 'x', io, initialMtime: 1000, debounceMs: 10, onError });
    a.markDirty();
    await vi.advanceTimersByTimeAsync(20);
    expect(a.state).toBe('error');
    expect(a.lastError).toBe('permission');
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(io.write).toHaveBeenCalledTimes(1);
  });

  it('reintenta con backoff exponencial ante errores desconocidos', async () => {
    let fails = 2;
    const { io } = makeIO({
      write: async () => {
        if (fails-- > 0) throw new Error('disk full');
      },
    });
    const a = new Autosave({ getText: () => 'x', io, initialMtime: 1000, debounceMs: 10 });
    a.markDirty();
    await vi.advanceTimersByTimeAsync(20);
    expect(a.state).toBe('error');
    await vi.advanceTimersByTimeAsync(2000); // 1er reintento
    expect(a.state).toBe('error');
    await vi.advanceTimersByTimeAsync(4000); // 2º reintento
    expect(a.state).toBe('saved');
    expect(io.write).toHaveBeenCalledTimes(3);
  });

  it('no escribe si el texto no cambió desde el último guardado', async () => {
    const { io, writes } = makeIO();
    const a = new Autosave({ getText: () => 'same', io, initialMtime: 1000, debounceMs: 10 });
    a.accept(1000, 'same');
    a.markDirty();
    await vi.advanceTimersByTimeAsync(20);
    expect(writes).toEqual([]);
    expect(a.state).toBe('saved');
  });

  it('guardado periódico fuerza la escritura si el debounce se reinicia constantemente', async () => {
    let text = '';
    const { io, writes } = makeIO();
    const a = new Autosave({ getText: () => text, io, initialMtime: 1000, debounceMs: 1000, periodicMs: 3000 });
    for (let i = 0; i < 10; i++) {
      text += 'x';
      a.markDirty();
      await vi.advanceTimersByTimeAsync(500); // siempre antes del debounce
    }
    expect(writes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('classifyError', () => {
  it('clasifica excepciones DOM', () => {
    expect(classifyError(new DOMException('', 'NotAllowedError'))).toBe('permission');
    expect(classifyError(new DOMException('', 'NotFoundError'))).toBe('not-found');
    expect(classifyError(new DOMException('', 'NotSupportedError'))).toBe('unsupported');
    expect(classifyError(new Error('x'))).toBe('unknown');
  });
});
