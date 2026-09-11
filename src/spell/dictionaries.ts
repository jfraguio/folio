/** Diccionario Hunspell de español servido desde public/dict/ (copiado por scripts/copy-dictionaries.mjs). */
export const SPELL_LANG = 'es';

/** URLs absolutas (necesarias en el worker, que no comparte baseURI con el documento). */
export function dictionaryUrls(): { aff: string; dic: string } {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  return { aff: `${base}dict/${SPELL_LANG}.aff`, dic: `${base}dict/${SPELL_LANG}.dic` };
}
