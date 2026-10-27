import { describe, expect, it } from 'vitest';
import {
  SECRET_ITERATIONS,
  applyTextEdits,
  findEncryptedSecrets,
  parseEncryptedPayload,
  parsePendingSecrets,
  serializedEncrypted,
} from '../src/secrets/format';
import { decryptSecret, encryptSecret } from '../src/secrets/crypto';

const FAST = { iterations: 1000 };

describe('sintaxis de bloques pendientes', () => {
  it('encuentra varios bloques y conserva el contenido exacto, con espacios y saltos', () => {
    const text = [
      'Pista visible.',
      '',
      '<secret:primera>',
      '  línea con sangría',
      'otra línea  ',
      '</secret:primera>',
      '',
      'Entre bloques.',
      '<secret:segunda>sin saltos</secret:segunda>Fin.',
    ].join('\n');
    const { blocks, error } = parsePendingSecrets(text);
    expect(error).toBeUndefined();
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.password).toBe('primera');
    expect(blocks[0]!.content).toBe('\n  línea con sangría\notra línea  \n');
    expect(blocks[1]!.password).toBe('segunda');
    expect(blocks[1]!.content).toBe('sin saltos');

    const next = applyTextEdits(
      text,
      blocks.map((b) => ({ from: b.from, to: b.to, text: `[${b.password}]` })),
    );
    expect(next).toBe('Pista visible.\n\n[primera]\n\nEntre bloques.\n[segunda]Fin.');
  });

  it('acepta el cierre sin contraseña y el cierre sin barra', () => {
    expect(parsePendingSecrets('<secret:a>x</secret>').blocks[0]!.content).toBe('x');
    expect(parsePendingSecrets('<secret:a>x<secret>').blocks[0]!.content).toBe('x');
  });

  it('rechaza contraseñas vacías, marcas incompletas, cierres sueltos y anidamientos', () => {
    const cases: [string, RegExp][] = [
      ['<secret:>\nx\n</secret:>', /contraseña del bloque está vacía/],
      ['<secret:a>\nx', /falta la marca de cierre/],
      ['\n</secret:a>', /cierre sin una apertura/],
      ['<secret:a>\n<secret:b>\nx\n</secret:b>\n</secret:a>', /no se pueden anidar/],
      ['<secret:a>\nx\n</secret:b>', /no coincide con la contraseña/],
      ['<secret>\nx\n</secret>', /necesita una contraseña/],
      ['<secret:a\nx</secret:a>', /apertura está incompleta/],
      ['</secret', /cierre está incompleta/],
    ];
    for (const [text, message] of cases) {
      const result = parsePendingSecrets(text);
      expect(result.blocks).toEqual([]);
      expect(result.error?.message).toMatch(message);
    }
  });

  it('no confunde el texto normal con una marca', () => {
    const text = 'Un <secretario> y una etiqueta </secretismo> no son bloques.';
    expect(parsePendingSecrets(text)).toEqual({ blocks: [] });
  });
});

describe('formato y criptografía de bloques cifrados', () => {
  it('cifra con los parámetros pedidos y descifra conservando Unicode y saltos', async () => {
    const plain = 'Línea 1\n  espacios y tabulaciones\t\nEmoji: 🔐🧪\nFin.';
    const raw = await encryptSecret(plain, 'contraseña con espacios', FAST);
    expect(raw).toMatch(
      /^<folio-secret:v1:pbkdf2-hmac-sha256:1000:aes-256-gcm:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+>$/,
    );
    expect(raw).not.toContain('contraseña con espacios');
    expect(await decryptSecret(raw, 'contraseña con espacios')).toBe(plain);
  });

  it('usa una sal y un IV nuevos en cada cifrado', async () => {
    const a = parseEncryptedPayload(await encryptSecret('mismo texto', 'clave', FAST));
    const b = parseEncryptedPayload(await encryptSecret('mismo texto', 'clave', FAST));
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('rechaza una contraseña distinta sin devolver contenido parcial', async () => {
    const raw = await encryptSecret('secreto', 'correcta', FAST);
    await expect(decryptSecret(raw, 'incorrecta')).rejects.toThrow(/no permite descifrar/);
  });

  it('rechaza datos, parámetros o etiqueta manipulados', async () => {
    const raw = await encryptSecret('secreto autenticado', 'clave', FAST);
    const payload = parseEncryptedPayload(raw);
    const flip = (value: string) => (value[0] === 'A' ? 'B' : 'A') + value.slice(1);

    const tampered = [
      serializedEncrypted({ ...payload, data: flip(payload.data) }),
      serializedEncrypted({ ...payload, salt: flip(payload.salt) }),
      serializedEncrypted({ ...payload, iv: flip(payload.iv) }),
      serializedEncrypted({ ...payload, iterations: payload.iterations + 1 }),
    ];
    for (const bad of tampered) await expect(decryptSecret(bad, 'clave')).rejects.toThrow();

    await expect(
      decryptSecret(serializedEncrypted({ ...payload, data: payload.data.slice(0, -1) }), 'clave'),
    ).rejects.toThrow();
  });

  it('detecta representaciones dañadas y conserva su texto', async () => {
    const valid = await encryptSecret('contenido', 'clave', FAST);
    const text = `Antes\n${valid}\nMedio\n<folio-secret:v1:solo-dos-campos>\nDespués\n<folio-secret:v1:sin-cierre`;
    const found = findEncryptedSecrets(text);
    expect(found.blocks).toHaveLength(2);
    expect(found.blocks[0]!.payload).toBeDefined();
    expect(found.blocks[1]!.problem).toBeDefined();
    expect(found.issues).toHaveLength(1);
    expect(text).toContain(valid);
    expect(text).toContain('<folio-secret:v1:solo-dos-campos>');
  });

  it('usa 600.000 iteraciones como mínimo inicial', async () => {
    expect(SECRET_ITERATIONS).toBeGreaterThanOrEqual(600_000);
    const raw = await encryptSecret('inicial', 'clave');
    expect(raw).toContain(':600000:');
    expect(await decryptSecret(raw, 'clave')).toBe('inicial');
  });
});
