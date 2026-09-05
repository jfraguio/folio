import { el, relativeTime } from './el';
import type { SaveState } from '../persistence/autosave';

export type DotState = SaveState | 'degraded';

const LABELS: Record<DotState, string> = {
  idle: '',
  dirty: 'Cambios sin guardar',
  saving: 'Guardando…',
  saved: 'Guardado',
  error: 'No se pudo guardar · pulsa para resolver',
  conflict: 'El archivo cambió en el disco · pulsa para resolver',
  degraded: 'Borrador local · descarga el .md desde la paleta',
};

type StatusListener = (state: DotState, lastSaved?: number) => void;

/** Último estado del guardado, observable: lo comparten todos los puntos de estado de la sesión. */
export class SaveStatus {
  state: DotState = 'idle';
  lastSaved: number | undefined;
  private listeners = new Set<StatusListener>();

  constructor(main: StatusListener) {
    this.listeners.add(main);
  }

  set(state: DotState, lastSaved?: number): void {
    this.state = state;
    if (lastSaved) this.lastSaved = lastSaved;
    this.listeners.forEach((l) => l(state, lastSaved));
  }

  /** Suscribe un indicador; recibe el estado actual de inmediato. Devuelve la baja. */
  subscribe(l: StatusListener): () => void {
    this.listeners.add(l);
    l(this.state, this.lastSaved);
    return () => this.listeners.delete(l);
  }
}

export class StatusDot {
  readonly root: HTMLButtonElement;
  private tip: HTMLElement;
  private state: DotState = 'idle';
  private lastSaved: number | null = null;

  constructor(onClick: (state: DotState) => void) {
    this.tip = el('span', { class: 'status-dot__tip' });
    this.root = el(
      'button',
      {
        class: 'status-dot',
        dataset: { state: 'idle' },
        attrs: { 'aria-label': 'Estado del guardado' },
        on: { click: () => onClick(this.state), mouseenter: () => this.refreshTip() },
      },
      this.tip,
    );
  }

  set(state: DotState, lastSaved?: number): void {
    this.state = state;
    if (lastSaved) this.lastSaved = lastSaved;
    this.root.dataset.state = state;
    this.refreshTip();
  }

  private refreshTip(): void {
    this.tip.textContent =
      this.state === 'saved' && this.lastSaved ? `Guardado ${relativeTime(this.lastSaved)}` : LABELS[this.state];
  }
}
