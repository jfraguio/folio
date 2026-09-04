export interface Command {
  id: string;
  label: string | (() => string);
  /** Atajo mostrado en la paleta (p. ej. "⌘K"). */
  shortcut?: string;
  keywords?: string;
  /** Si devuelve false, el comando no se muestra en la paleta. */
  when?: () => boolean;
  /** Nunca aparece en la paleta (solo accesible por atajo o internamente). */
  hidden?: boolean;
  run: () => void | Promise<void>;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(...cmds: Command[]): void {
    for (const c of cmds) this.commands.set(c.id, c);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  visible(): Command[] {
    return [...this.commands.values()].filter((c) => !c.hidden && (!c.when || c.when()));
  }

  async run(id: string): Promise<boolean> {
    const c = this.commands.get(id);
    if (!c) return false;
    await c.run();
    return true;
  }
}

export function labelOf(c: Command): string {
  return typeof c.label === 'function' ? c.label() : c.label;
}
