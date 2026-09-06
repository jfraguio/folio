/**
 * Evita que la misma novela se edite en dos pestañas a la vez.
 * Usa navigator.locks (si existe) y BroadcastChannel para coordinar.
 *
 * El bloqueo es una salvaguarda, no una barrera: si la otra pestaña no responde
 * (congelada, descartada, colgada) el usuario siempre puede abrir la novela aquí.
 */
export type TakeoverResult = 'granted' | 'refused' | 'no-response';

export interface NovelLock {
  acquired: boolean;
  release(): void;
  /**
   * Pide a la otra pestaña que ceda el control. Si lo hace, esta pestaña pasa a
   * tener el bloqueo. `refused` significa que la otra pestaña respondió que no
   * (p. ej. tiene cambios que no ha podido guardar); `no-response` que nadie contestó.
   */
  requestTakeover(): Promise<TakeoverResult>;
  onTakeoverRequest(handler: () => boolean | Promise<boolean>): void;
}

const TAKEOVER_TIMEOUT_MS = 3000;

export async function acquireNovelLock(novelId: string): Promise<NovelLock> {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('folio') : null;
  let release: () => void = () => {};
  let acquired = false;
  let takeoverHandler: (() => boolean | Promise<boolean>) | null = null;

  const tryAcquire = (): Promise<boolean> => {
    if (!navigator.locks) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      void navigator.locks.request(`folio:${novelId}`, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return Promise.resolve();
        }
        resolve(true);
        return new Promise<void>((done) => {
          release = done;
        });
      });
    });
  };

  acquired = await tryAcquire();

  channel?.addEventListener('message', async (ev: MessageEvent) => {
    const msg = ev.data as { type: string; novelId: string };
    if (msg?.novelId !== novelId) return;
    if (msg.type === 'takeover-request' && acquired && takeoverHandler) {
      const ok = await takeoverHandler();
      if (ok) {
        release();
        acquired = false;
      }
      // El handler suele cerrar la sesión (y con ella este canal), así que la respuesta
      // sale por un canal propio; si no, la otra pestaña nunca se enteraría de que hemos cedido.
      const out = new BroadcastChannel('folio');
      out.postMessage({ type: 'takeover-response', novelId, ok });
      out.close();
    }
  });

  return {
    get acquired() {
      return acquired;
    },
    release() {
      release();
      release = () => {};
      acquired = false;
      channel?.close();
    },
    async requestTakeover() {
      if (!channel) return 'no-response';
      const answer = await new Promise<boolean | null>((resolve) => {
        const timer = setTimeout(() => {
          channel.removeEventListener('message', onMsg);
          resolve(null);
        }, TAKEOVER_TIMEOUT_MS);
        const onMsg = (ev: MessageEvent) => {
          const msg = ev.data as { type: string; novelId: string; ok: boolean };
          if (msg?.type === 'takeover-response' && msg.novelId === novelId) {
            clearTimeout(timer);
            channel.removeEventListener('message', onMsg);
            resolve(msg.ok);
          }
        };
        channel.addEventListener('message', onMsg);
        channel.postMessage({ type: 'takeover-request', novelId });
      });
      if (answer === null) return 'no-response';
      if (!answer) return 'refused';
      // La otra pestaña ha soltado el bloqueo: lo tomamos para que futuras pestañas nos encuentren.
      // La liberación del Web Lock y el mensaje llegan por caminos distintos, así que se reintenta un poco.
      for (let i = 0; i < 10 && !(acquired = await tryAcquire()); i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      return 'granted';
    },
    onTakeoverRequest(handler) {
      takeoverHandler = handler;
    },
  };
}
