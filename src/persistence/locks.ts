/**
 * Evita que la misma novela se edite en dos pestañas a la vez.
 * Usa navigator.locks (si existe) y BroadcastChannel para coordinar.
 */
export interface NovelLock {
  acquired: boolean;
  release(): void;
  /** Pide a la otra pestaña que ceda el control. Resuelve true si lo hace. */
  requestTakeover(): Promise<boolean>;
  onTakeoverRequest(handler: () => boolean | Promise<boolean>): void;
}

export async function acquireNovelLock(novelId: string): Promise<NovelLock> {
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('folio') : null;
  let release: () => void = () => {};
  let acquired = false;
  let takeoverHandler: (() => boolean | Promise<boolean>) | null = null;

  if (navigator.locks) {
    acquired = await new Promise<boolean>((resolve) => {
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
  } else {
    acquired = true;
  }

  channel?.addEventListener('message', async (ev: MessageEvent) => {
    const msg = ev.data as { type: string; novelId: string };
    if (msg?.novelId !== novelId) return;
    if (msg.type === 'takeover-request' && acquired && takeoverHandler) {
      const ok = await takeoverHandler();
      if (ok) {
        release();
        acquired = false;
      }
      channel.postMessage({ type: 'takeover-response', novelId, ok });
    }
  });

  return {
    get acquired() {
      return acquired;
    },
    release() {
      release();
      acquired = false;
      channel?.close();
    },
    requestTakeover() {
      if (!channel) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 1500);
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
    },
    onTakeoverRequest(handler) {
      takeoverHandler = handler;
    },
  };
}
