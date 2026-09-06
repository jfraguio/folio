import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireNovelLock } from '../src/persistence/locks';

/**
 * Simulación mínima de navigator.locks: un mapa nombre → liberador. Solo soporta
 * `ifAvailable`, que es lo único que usa Folio.
 */
function fakeLocks() {
  const held = new Set<string>();
  return {
    held,
    request(name: string, opts: { ifAvailable?: boolean }, cb: (lock: object | null) => Promise<void>) {
      if (held.has(name)) return cb(null);
      held.add(name);
      // Como en el navegador: el bloqueo se suelta cuando la promesa del callback se resuelve.
      return cb({ name }).then(() => {
        held.delete(name);
      });
    },
  };
}

let locks: ReturnType<typeof fakeLocks>;

beforeEach(() => {
  locks = fakeLocks();
  Object.defineProperty(globalThis.navigator, 'locks', { value: locks, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
});

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('acquireNovelLock', () => {
  it('la primera pestaña adquiere; la segunda no', async () => {
    const a = await acquireNovelLock('n1');
    const b = await acquireNovelLock('n1');
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(false);
    a.release();
    b.release();
  });

  it('release libera de verdad y una apertura posterior en la misma pestaña vuelve a adquirir', async () => {
    const a = await acquireNovelLock('n1');
    a.release();
    await tick();
    const b = await acquireNovelLock('n1');
    expect(b.acquired).toBe(true);
    b.release();
  });

  it('release es idempotente', async () => {
    const a = await acquireNovelLock('n1');
    a.release();
    expect(() => a.release()).not.toThrow();
  });

  it('cesión aceptada: la segunda pestaña pasa a tener el bloqueo aunque la primera cierre su canal al ceder', async () => {
    const a = await acquireNovelLock('n1');
    const b = await acquireNovelLock('n1');
    // Como hace la sesión real: al ceder, desmonta todo (incluido el lock, que cierra su canal).
    a.onTakeoverRequest(() => {
      a.release();
      return true;
    });
    const result = await b.requestTakeover();
    expect(result).toBe('granted');
    expect(a.acquired).toBe(false);
    expect(b.acquired).toBe(true);
    b.release();
  });

  it('cesión rechazada: se distingue de la falta de respuesta', async () => {
    const a = await acquireNovelLock('n1');
    const b = await acquireNovelLock('n1');
    a.onTakeoverRequest(() => false);
    expect(await b.requestTakeover()).toBe('refused');
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(false);
    a.release();
    b.release();
  });

  it('sin respuesta: si la otra pestaña no contesta (p. ej. bloqueo huérfano) se informa como no-response', async () => {
    vi.useFakeTimers();
    const a = await acquireNovelLock('n1'); // nunca registra handler: simula una sesión que murió a medias
    const b = await acquireNovelLock('n1');
    const p = b.requestTakeover();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBe('no-response');
    a.release();
    b.release();
  });
});
