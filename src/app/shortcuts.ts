import type { CommandRegistry } from './commands';

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Combinaciones: "Mod" es ⌘ en Mac y Ctrl en el resto. */
export const SHORTCUTS: Record<string, string> = {
  'Mod-k': 'palette',
  'Mod-p': 'chapters',
  'Mod-Shift-f': 'fullscreen',
  'Mod-Shift-d': 'dictionary.add',
  'Mod-Shift-l': 'theme.toggle',
  'Mod-=': 'font.increase',
  'Mod-+': 'font.increase',
  'Mod--': 'font.decrease',
  'Mod-s': 'save',
};

export function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (IS_MAC ? e.metaKey : e.ctrlKey) parts.push('Mod');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  let key = e.key;
  if (key.length === 1) key = key.toLowerCase();
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
