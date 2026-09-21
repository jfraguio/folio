export type Theme = 'light' | 'dark' | 'system';

export interface Prefs {
  theme: Theme;
  spellEnabled: boolean;
  /** Modo zen: solo la tab abierta, tipografía de Folio y sustituciones al teclear (— « »). */
  zen: boolean;
}

const DEFAULTS: Prefs = {
  theme: 'system',
  spellEnabled: true,
  zen: false,
};

const KEYS: Record<keyof Prefs, string> = {
  theme: 'todo.theme',
  spellEnabled: 'todo.spell.enabled',
  zen: 'todo.zen',
};

type Listener = <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;

class PrefsStore {
  private listeners = new Set<Listener>();

  get<K extends keyof Prefs>(key: K): Prefs[K] {
    const raw = safeGet(KEYS[key]);
    if (raw === null) return DEFAULTS[key];
    const def = DEFAULTS[key];
    if (typeof def === 'boolean') return (raw === 'true') as Prefs[K];
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

/** Colores de fondo de cada tema (los mismos que --bg en tokens.css), para la barra del navegador. */
const THEME_COLORS = { light: '#f5f4f0', dark: '#111111' } as const;

/** Aplica el tema al documento y escucha cambios del sistema si procede. */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // En móvil y PWA la barra de estado/navegador toma este color: debe acompañar al tema.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
}

/** El CSS del modo zen (tabs y editor) cuelga de `html[data-zen]`. */
export function applyZen(on: boolean): void {
  document.documentElement.toggleAttribute('data-zen', on);
}

export function initPrefsEffects(): void {
  applyTheme(prefs.get('theme'));
  applyZen(prefs.get('zen'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (prefs.get('theme') === 'system') applyTheme('system');
  });
  prefs.onChange((key, value) => {
    if (key === 'theme') applyTheme(value as Theme);
    if (key === 'zen') applyZen(value as boolean);
  });
}
