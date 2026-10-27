import {
  SECRET_CIPHER,
  SECRET_ITERATIONS,
  SECRET_KDF,
  SECRET_MAX_ITERATIONS,
  SECRET_VERSION,
  SecretFormatError,
  parseEncryptedPayload,
  serializedEncrypted,
  type EncryptedPayload,
} from './format';

/**
 * Cifrado de bloques con la Web Crypto API. Nada sale del navegador:
 *
 * - AES-256-GCM con etiqueta de autenticación de 128 bits.
 * - PBKDF2-HMAC-SHA-256 con una sal aleatoria de 16 bytes por bloque y 600.000 iteraciones.
 * - IV aleatorio de 12 bytes nuevo en cada operación.
 *
 * La clave derivada y la contraseña no se guardan en ningún sitio. La representación textual
 * incluye todos los parámetros necesarios para descifrar (versión, algoritmos, iteraciones, sal,
 * IV y datos con su etiqueta) en Base64.
 *
 * Los parámetros del bloque se autentican como datos asociados (AAD): cambiar la versión, las
 * iteraciones, la sal o el IV no da un texto distinto, sino un fallo de autenticación.
 */

export class SecretCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretCryptoError';
  }
}

export interface EncryptSecretOptions {
  /** Solo para pruebas o migraciones futuras; los bloques nuevos usan SECRET_ITERATIONS. */
  iterations?: number;
}

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BITS = 128;

function subtle(): SubtleCrypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new SecretCryptoError(
      'Este navegador no ofrece Web Crypto. Abre folio en HTTPS o en localhost para cifrar bloques.',
    );
  }
  return crypto.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // En trozos: `String.fromCharCode(...bytes)` desborda la pila con textos grandes.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    throw new SecretFormatError('Los datos del bloque cifrado no están codificados correctamente.');
  }
}

function aad(
  payload: Pick<EncryptedPayload, 'version' | 'kdf' | 'iterations' | 'cipher' | 'salt' | 'iv'>,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `folio-secret|${payload.version}|${payload.kdf}|${payload.iterations}|${payload.cipher}|${payload.salt}|${payload.iv}`,
  );
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const api = subtle();
  const material = await api.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return api.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra un texto y devuelve la representación textual de un bloque. */
export async function encryptSecret(
  text: string,
  password: string,
  options: EncryptSecretOptions = {},
): Promise<string> {
  const iterations = options.iterations ?? SECRET_ITERATIONS;
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > SECRET_MAX_ITERATIONS) {
    throw new SecretCryptoError('El número de iteraciones no es válido.');
  }
  if (!password) throw new SecretCryptoError('La contraseña no puede estar vacía.');
  if (/[>\r\n]/.test(password)) {
    throw new SecretCryptoError('La contraseña no puede contener «>» ni saltos de línea.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const salt64 = toBase64(salt);
  const iv64 = toBase64(iv);
  const key = await deriveKey(password, salt, iterations);
  const encrypted = await subtle().encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: aad({
        version: SECRET_VERSION,
        kdf: SECRET_KDF,
        iterations,
        cipher: SECRET_CIPHER,
        salt: salt64,
        iv: iv64,
      }),
      tagLength: TAG_BITS,
    },
    key,
    new TextEncoder().encode(text),
  );

  return serializedEncrypted({
    version: SECRET_VERSION,
    kdf: SECRET_KDF,
    iterations,
    cipher: SECRET_CIPHER,
    salt: salt64,
    iv: iv64,
    data: toBase64(new Uint8Array(encrypted)),
  });
}

/**
 * Descifra una representación completa usando los parámetros guardados en ella. Si la
 * autenticación falla (contraseña incorrecta o bloque modificado), lanza y no devuelve nada.
 */
export async function decryptSecret(raw: string, password: string): Promise<string> {
  const payload = parseEncryptedPayload(raw);
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const data = fromBase64(payload.data);
  if (salt.length !== SALT_BYTES) throw new SecretFormatError('La sal del bloque no tiene 16 bytes.');
  if (iv.length !== IV_BYTES) throw new SecretFormatError('El IV del bloque no tiene 12 bytes.');
  if (data.length < TAG_BITS / 8)
    throw new SecretFormatError('Al bloque cifrado le falta la etiqueta de autenticación.');

  const key = await deriveKey(password, salt, payload.iterations);
  try {
    const plain = await subtle().decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad(payload),
        tagLength: TAG_BITS,
      },
      key,
      data,
    );
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch {
    throw new SecretCryptoError('La contraseña no permite descifrar este bloque o el bloque está dañado.');
  }
}
