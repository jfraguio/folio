/** Diccionario Hunspell de español servido desde public/dict/ (copiado por scripts/copy-dictionaries.mjs). */
export const SPELL_LANG = 'es';

/** URLs absolutas (necesarias en el worker, que no comparte baseURI con el documento). */
export function dictionaryUrls(): { aff: string; dic: string } {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  // `?v=` cambia con cada build: el runtime cache no sirve un diccionario antiguo tras actualizar.
  // El guard de `typeof` evita un ReferenceError fuera de un build de Vite (p. ej. en tests).
  const version = typeof __DICT_VERSION__ === 'string' ? __DICT_VERSION__ : 'dev';
  return {
    aff: `${base}dict/${SPELL_LANG}.aff?v=${version}`,
    dic: `${base}dict/${SPELL_LANG}.dic?v=${version}`,
  };
}
