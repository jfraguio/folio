import type { EditorState, StateEffect } from '@codemirror/state';

/** Lo mínimo que necesita `TabStates` del editor: su estado y cómo sustituirlo. */
export interface StateHost {
  readonly state: EditorState;
  setState(state: EditorState): void;
}

/**
 * Guarda un `EditorState` por tab y subtab. Cada estado conserva su propio deshacer, cursor y
 * selección, así que cambiar de tab (que aquí es solo `setState`) no entra en ningún historial y
 * ⌘Z no puede colar el texto de otra tab.
 *
 * Las tabs se identifican por referencia (el objeto `Tab`), no por índice: así quitar una tab o
 * subtab no obliga a renumerar el resto.
 */
export class TabStates {
  private readonly slots = new Map<object, EditorState[]>();

  constructor(
    private readonly host: StateHost,
    private readonly build: (doc: string) => EditorState,
  ) {}

  /** Asocia un estado ya visible a `(tab, sub)` sin volver a volcarlo. */
  seed(tab: object, sub: number, state: EditorState): void {
    this.write(tab, sub, state);
  }

  /** Guarda lo que muestra el editor bajo `(tab, sub)`; `sub` es -1 para la tab principal. */
  save(tab: object, sub: number): void {
    this.write(tab, sub, this.host.state);
  }

  /**
   * Carga en el editor `(tab, sub)`, reutilizando su estado guardado o creando uno nuevo con `doc`.
   * Devuelve `true` si el estado es nuevo (la sesión coloca entonces el cursor al final).
   */
  load(tab: object, sub: number, doc: string): boolean {
    const cached = this.slots.get(tab)?.[sub + 1];
    this.host.setState(cached ?? this.build(doc));
    return cached === undefined;
  }

  /** Sustituye el estado visible por `state` sin pasar por el historial. */
  set(tab: object, sub: number, state: EditorState): void {
    this.write(tab, sub, state);
    this.host.setState(state);
  }

  drop(tab: object): void {
    this.slots.delete(tab);
  }

  /** Olvida la subtab `sub` de `tab`, desplazando las siguientes. */
  dropSub(tab: object, sub: number): void {
    this.slots.get(tab)?.splice(sub + 1, 1);
  }

  /** Olvida todos los estados (p. ej. al recargar el documento entero desde el disco). */
  clear(): void {
    this.slots.clear();
  }

  /** Aplica un efecto (p. ej. reconfigurar un compartimento) a todos los estados guardados. */
  updateAll(effect: StateEffect<unknown>): void {
    for (const arr of this.slots.values()) {
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s && s !== this.host.state) arr[i] = s.update({ effects: effect }).state;
      }
    }
  }

  private write(tab: object, sub: number, state: EditorState): void {
    const arr = this.slots.get(tab) ?? [];
    arr[sub + 1] = state;
    this.slots.set(tab, arr);
  }
}
