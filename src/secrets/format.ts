/**
 * Sintaxis y formato textual de los bloques cifrados.
 *
 * Texto pendiente de cifrar:
 *
 *   <secret:contraseña>
 *   Contenido exacto, con sus espacios y saltos de línea.
 *   </secret:contraseña>
 *
 * También se acepta `</secret>` como cierre (sin repetir la contraseña) y el cierre sin barra
 * `<secret>`, pero al descifrar se restaura siempre la forma explícita `</secret:contraseña>`.
 *
 * Bloque ya cifrado (una sola línea, para que no se confunda con las marcas pendientes):
 *
 *   <folio-secret:v1:pbkdf2-hmac-sha256:600000:aes-256-gcm:SAL:IV:DATOS>
 *
 * La contraseña no forma parte del bloque cifrado. Las restricciones de la contraseña vienen de
 * la propia marca: no puede estar vacía, no puede contener `>` (cierra la marca) ni saltos de
 * línea (las marcas ocupan una sola línea).
 */

/** Iteraciones de PBKDF2 que usan los bloques nuevos. */
export const SECRET_ITERATIONS = 600_000;
/** Tope defensivo al leer un bloque: evita que una representación manipulada bloquee el navegador. */
export const SECRET_MAX_ITERATIONS = 5_000_000;

export const SECRET_VERSION = 'v1';
export const SECRET_KDF = 'pbkdf2-hmac-sha256';
export const SECRET_CIPHER = 'aes-256-gcm';

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const TOKEN_RE = /<secret(?=[:>]|$)|<\/secret(?=[:>]|$)/g;
const ENCRYPTED_RE = /<folio-secret(?::[^>\r\n]*)?>/g;

export interface SecretIssue {
  /** Posición del problema en el texto. */
  offset: number;
  /** Mensaje ya listo para mostrar, con el número de línea. */
  message: string;
}

/** Un bloque pendiente de cifrar. `content` es exactamente lo que hay entre las dos marcas. */
export interface PendingSecretBlock {
  from: number;
  to: number;
  contentFrom: number;
  contentTo: number;
  password: string;
  content: string;
}

export interface ParsePendingResult {
  blocks: PendingSecretBlock[];
  /** Primer problema encontrado. Si existe, no se debe cifrar nada. */
  error?: SecretIssue;
}

export interface EncryptedPayload {
  version: typeof SECRET_VERSION;
  kdf: typeof SECRET_KDF;
  iterations: number;
  cipher: typeof SECRET_CIPHER;
  /** Sal en Base64 (16 bytes). */
  salt: string;
  /** IV en Base64 (12 bytes). */
  iv: string;
  /** Texto cifrado + etiqueta de autenticación, en Base64. */
  data: string;
  /** Representación textual completa. */
  raw: string;
}

export interface EncryptedSecretBlock {
  from: number;
  to: number;
  raw: string;
  payload?: EncryptedPayload;
  /** El bloque parece cifrado pero no se puede interpretar; se conserva tal cual. */
  problem?: string;
}

export interface FindEncryptedResult {
  blocks: EncryptedSecretBlock[];
  /** Restos que empiezan como un bloque cifrado pero no llegan a cerrarse. */
  issues: SecretIssue[];
}

export class SecretFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretFormatError';
  }
}

function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

function issue(text: string, offset: number, message: string): SecretIssue {
  return { offset, message: `Línea ${lineOf(text, offset)}: ${message}` };
}

function validBase64(value: string): boolean {
  return value.length > 0 && BASE64_RE.test(value);
}

/** Valida e interpreta la representación textual de un bloque cifrado. */
export function parseEncryptedPayload(raw: string): EncryptedPayload {
  const m = /^<folio-secret:([^<>\r\n]+)>$/.exec(raw);
  if (!m) throw new SecretFormatError('El bloque cifrado no tiene un formato válido.');

  const fields = m[1]!.split(':');
  if (fields.length !== 7) {
    throw new SecretFormatError('El bloque cifrado no tiene todos los parámetros esperados.');
  }
  const [version, kdf, rawIterations, cipher, salt, iv, data] = fields as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  if (version !== SECRET_VERSION) throw new SecretFormatError('La versión del bloque cifrado no es compatible.');
  if (kdf !== SECRET_KDF) throw new SecretFormatError('El algoritmo de derivación del bloque no es compatible.');
  if (cipher !== SECRET_CIPHER) throw new SecretFormatError('El algoritmo de cifrado del bloque no es compatible.');
  if (!/^\d+$/.test(rawIterations)) throw new SecretFormatError('El número de iteraciones del bloque no es válido.');
  const iterations = Number(rawIterations);
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > SECRET_MAX_ITERATIONS) {
    throw new SecretFormatError('El número de iteraciones del bloque está fuera de rango.');
  }
  if (!validBase64(salt) || !validBase64(iv) || !validBase64(data)) {
    throw new SecretFormatError('Los datos del bloque cifrado no están codificados correctamente.');
  }
  return { version, kdf, iterations, cipher, salt, iv, data, raw };
}

/** Construye la representación textual de un bloque cifrado. */
export function serializedEncrypted(payload: Omit<EncryptedPayload, 'raw'>): string {
  return (
    `<folio-secret:${payload.version}:${payload.kdf}:${payload.iterations}:${payload.cipher}:` +
    `${payload.salt}:${payload.iv}:${payload.data}>`
  );
}

/**
 * Busca y valida los bloques pendientes de cifrar. Devuelve el primer error y ningún bloque si
 * la sintaxis no es correcta: así el llamador puede validar todo antes de tocar el documento.
 */
export function parsePendingSecrets(text: string): ParsePendingResult {
  const blocks: PendingSecretBlock[] = [];
  let open: { from: number; contentFrom: number; password: string } | null = null;
  let pos = 0;

  while (pos < text.length) {
    TOKEN_RE.lastIndex = pos;
    const match = TOKEN_RE.exec(text);
    if (!match) break;
    const at = match.index;
    const rest = text.slice(at);

    if (rest.startsWith('</secret')) {
      const closing = /^<\/secret(?::([^>\r\n]*))?>/.exec(rest);
      if (!closing) {
        return { blocks: [], error: issue(text, at, 'la marca de cierre está incompleta.') };
      }
      if (!open) {
        return { blocks: [], error: issue(text, at, 'hay una marca de cierre sin una apertura.') };
      }
      const closingPassword = closing[1];
      if (closingPassword !== undefined && closingPassword !== open.password) {
        return {
          blocks: [],
          error: issue(text, at, 'la marca de cierre no coincide con la contraseña de la apertura.'),
        };
      }
      const end = at + closing[0].length;
      blocks.push({
        from: open.from,
        to: end,
        contentFrom: open.contentFrom,
        contentTo: at,
        password: open.password,
        content: text.slice(open.contentFrom, at),
      });
      open = null;
      pos = end;
      continue;
    }

    if (rest.startsWith('<secret>')) {
      if (!open) {
        return {
          blocks: [],
          error: issue(text, at, 'la marca de apertura necesita una contraseña: <secret:contraseña>.'),
        };
      }
      const end = at + '<secret>'.length;
      blocks.push({
        from: open.from,
        to: end,
        contentFrom: open.contentFrom,
        contentTo: at,
        password: open.password,
        content: text.slice(open.contentFrom, at),
      });
      open = null;
      pos = end;
      continue;
    }

    const opening = /^<secret:([^>\r\n]*)>/.exec(rest);
    if (!opening) {
      return {
        blocks: [],
        error: issue(
          text,
          at,
          'la marca de apertura está incompleta o contiene un salto de línea; la contraseña no puede incluir «>».',
        ),
      };
    }
    if (open) {
      return { blocks: [], error: issue(text, at, 'los bloques cifrados no se pueden anidar.') };
    }
    const password = opening[1]!;
    if (!password) {
      return { blocks: [], error: issue(text, at, 'la contraseña del bloque está vacía.') };
    }
    open = { from: at, contentFrom: at + opening[0].length, password };
    pos = at + opening[0].length;
  }

  if (open) {
    return {
      blocks: [],
      error: issue(text, open.from, 'falta la marca de cierre del bloque que empieza aquí.'),
    };
  }
  return { blocks };
}

/** Busca todas las representaciones cifradas, incluidas las dañadas (que se conservan intactas). */
export function findEncryptedSecrets(text: string): FindEncryptedResult {
  const blocks: EncryptedSecretBlock[] = [];
  const issues: SecretIssue[] = [];
  let match: RegExpExecArray | null;
  ENCRYPTED_RE.lastIndex = 0;
  while ((match = ENCRYPTED_RE.exec(text))) {
    const raw = match[0];
    const block: EncryptedSecretBlock = { from: match.index, to: match.index + raw.length, raw };
    try {
      block.payload = parseEncryptedPayload(raw);
    } catch (e) {
      block.problem = e instanceof Error ? e.message : 'El bloque cifrado está dañado.';
    }
    blocks.push(block);
  }

  // Una representación a la que le falta el «>» (o que se partió con un salto de línea) no la
  // encuentra la expresión regular: se avisa igualmente, sin tocar lo que haya escrito.
  const startRe = /<folio-secret/g;
  while ((match = startRe.exec(text))) {
    const at = match.index;
    if (!blocks.some((b) => at >= b.from && at < b.to)) {
      issues.push(issue(text, at, 'hay una representación cifrada incompleta o dañada.'));
    }
  }
  return { blocks, issues };
}

export interface TextEdit {
  from: number;
  to: number;
  text: string;
}

/** Aplica sustituciones no solapadas sin tocar el resto del texto. */
export function applyTextEdits(source: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.from - a.from);
  let out = source;
  for (const edit of sorted) out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  return out;
}
