export type Theme = 'light' | 'dark' | 'system';

export interface Prefs {
  theme: Theme;
  fontSize: number;
  spellEnabled: boolean;
  lastTab: number;
}

const DEFAULTS: Prefs = {
  theme: 'system',
  fontSize: 21,
  spellEnabled: true,
  lastTab: 0,
};

const KEYS: Record<keyof Prefs, string> = {
  theme: 'todo.theme',
  fontSize: 'todo.fontSize',
  spellEnabled: 'todo.spell.enabled',
  lastTab: 'todo.lastTab',
};

export const FONT_SIZE_MIN = 16;
export const FONT_SIZE_MAX = 28;

type Listener = <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;

class PrefsStore {
  private listeners = new Set<Listener>();

  get<K extends keyof Prefs>(key: K): Prefs[K] {
    const raw = safeGet(KEYS[key]);
    if (raw === null) return DEFAULTS[key];
    const def = DEFAULTS[key];
    if (typeof def === 'boolean') return (raw === 'true') as Prefs[K];
    if (typeof def === 'number') {
      const n = Number(raw);
      return (Number.isFinite(n) ? n : def) as Prefs[K];
    }
    return raw as Prefs[K];
  }

  set<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    try {
      localStorage.setItem(KEYS[key], String(value));
    } catch {
      /* almacenamiento no disponible: se sigue en memoria */
    }
    this.listeners.forEach((l) => l(key, value));
  }

  toggle(key: { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs]): boolean {
    const v = !this.get(key);
    this.set(key, v);
    return v;
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export const prefs = new PrefsStore();

/** Aplica el tema al documento y escucha cambios del sistema si procede. */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function applyFontSize(px: number): void {
  document.documentElement.style.setProperty('--font-size', `${px}px`);
}

export function initPrefsEffects(): void {
  applyTheme(prefs.get('theme'));
  applyFontSize(prefs.get('fontSize'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (prefs.get('theme') === 'system') applyTheme('system');
  });
  prefs.onChange((key, value) => {
    if (key === 'theme') applyTheme(value as Theme);
    if (key === 'fontSize') applyFontSize(value as number);
  });
}
