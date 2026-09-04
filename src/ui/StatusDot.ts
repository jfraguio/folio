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
