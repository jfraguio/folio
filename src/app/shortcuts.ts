import type { CommandRegistry } from './commands';

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Combinaciones: "Mod" es ⌘ en Mac y Ctrl en el resto. */
export const SHORTCUTS: Record<string, string> = {
  'Mod-k': 'menu',
  'Mod-Shift-d': 'dictionary.add',
  'Mod-s': 'save',
  // Mod-1 … Mod-0: tabs 1 … 10. Mod-Alt-1 … Mod-Alt-0: subtabs 1 … 10 de la tab abierta. (Con
  // Shift no: en macOS ⌘⇧3, ⌘⇧4 y ⌘⇧5 son las capturas de pantalla y no llegan al navegador.)
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      [`Mod-${(i + 1) % 10}`, `tab.${i}`],
      [`Mod-Alt-${(i + 1) % 10}`, `subtab.${i}`],
    ]).flat(),
  ),
};

export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (IS_MAC ? e.metaKey : e.ctrlKey) parts.push('Mod');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  // Los dígitos se identifican por la tecla física (`Digit1`…`Digit0`), no por el carácter: con
  // Shift (o Alt) pulsado, `e.key` es el símbolo de la tecla («!», «"», «·»…), que además cambia
  // con la distribución del teclado.
  const digit = /^Digit(\d)$/.exec(e.code ?? '')?.[1];
  let key = digit ?? e.key;
  if (!digit && key.length === 1) key = key.toLowerCase();
  parts.push(key);
  return parts.join('-');
}

export function prettyShortcut(combo: string): string {
  // La tecla es lo que sigue al último separador; "Mod--" tiene como tecla "-".
  const idx = combo.lastIndexOf('-', combo.length - 2);
  const mods = idx >= 0 ? combo.slice(0, idx).split('-') : [];
  let key = combo.slice(idx + 1);
  if (key === '=') key = '+';
  if (key === '-') key = '−';
  const symbol: Record<string, string> = IS_MAC
    ? { Mod: '⌘', Shift: '⇧', Alt: '⌥' }
    : { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };
  const parts = [...mods.map((m) => symbol[m] ?? m), key.toUpperCase()];
  return parts.join(IS_MAC ? '' : '+');
}

export function shortcutFor(commandId: string): string | undefined {
  const combo = Object.entries(SHORTCUTS).find(([, id]) => id === commandId)?.[0];
  return combo ? prettyShortcut(combo) : undefined;
}

export function installShortcuts(registry: CommandRegistry): () => void {
  const onKey = (e: KeyboardEvent) => {
    const combo = comboOf(e);
    const id = SHORTCUTS[combo];
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    void registry.run(id);
  };
  window.addEventListener('keydown', onKey, true);
  return () => window.removeEventListener('keydown', onKey, true);
}
