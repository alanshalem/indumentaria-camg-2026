import { describe, expect, it } from 'vitest';
import { normalizeName } from '../shared/domain/name';
import { formatPhone, parseArgentineMobile, whatsappLink } from '../shared/domain/phone';

describe('normalizeName', () => {
  it('arregla el grito y el todo-minuscula', () => {
    expect(normalizeName('NATALIA BACCHETTO')).toBe('Natalia Bacchetto');
    expect(normalizeName('marianela fontana')).toBe('Marianela Fontana');
    expect(normalizeName('Viviana Marisa Dominguez')).toBe('Viviana Marisa Dominguez');
  });

  it('respeta los acentos al bajar y al subir', () => {
    expect(normalizeName('MARÍA JOSÉ')).toBe('María José');
    expect(normalizeName('ángel')).toBe('Ángel');
  });

  it('deja en minuscula las particulas del medio', () => {
    expect(normalizeName('juan de la cruz')).toBe('Juan de la Cruz');
    expect(normalizeName('FERNANDEZ DE KIRCHNER')).toBe('Fernandez de Kirchner');
    expect(normalizeName('maria de los angeles')).toBe('Maria de los Angeles');
  });

  it('la particula que abre el apellido va en mayuscula', () => {
    // "Rodrigo De Paul", "Juan Martin Del Potro": asi se escriben en Argentina.
    expect(normalizeName('de paul')).toBe('De Paul');
    expect(normalizeName('DEL POTRO')).toBe('Del Potro');
  });

  it('no baja Di ni Van: aca se escriben con mayuscula', () => {
    expect(normalizeName('DI MARCO')).toBe('Di Marco');
    expect(normalizeName('van damme')).toBe('Van Damme');
  });

  it('capitaliza despues del guion y del apostrofe', () => {
    expect(normalizeName('ana-maria')).toBe('Ana-Maria');
    expect(normalizeName("d'angelo")).toBe("D'Angelo");
    expect(normalizeName("O'BRIEN")).toBe("O'Brien");
  });

  it('colapsa los espacios de mas', () => {
    expect(normalizeName('  juan    perez  ')).toBe('Juan Perez');
  });

  it('es idempotente: normalizar dos veces da lo mismo', () => {
    for (const raw of ['NATALIA BACCHETTO', 'juan de la cruz', "d'angelo", 'de paul']) {
      const una = normalizeName(raw);
      expect(normalizeName(una)).toBe(una);
    }
  });

  it('un vacio no explota', () => {
    expect(normalizeName('   ')).toBe('');
  });
});

describe('telefonos argentinos', () => {
  it('reconoce el numero como lo tipea la gente', () => {
    // Todas estas son la misma linea.
    for (const raw of [
      '1162788263',
      '11 6278-8263',
      '011 15 6278-8263',
      '+54 9 11 6278 8263',
      '5491162788263',
    ]) {
      expect(parseArgentineMobile(raw)).toEqual({ area: '11', subscriber: '62788263' });
    }
  });

  it('lo muestra completo y listo para copiar', () => {
    expect(formatPhone('1162788263')).toBe('+54 9 11 6278-8263');
    expect(formatPhone('1164952750')).toBe('+54 9 11 6495-2750');
  });

  it('arma el link de WhatsApp con el 9', () => {
    expect(whatsappLink('011 15 6278-8263')).toBe('https://wa.me/5491162788263');
  });

  it('un numero que no reconoce se muestra tal cual, sin inventarle el pais', () => {
    // Inventar un codigo de area es peor que mostrar el numero raro.
    expect(parseArgentineMobile('2214567890')).toBeNull();
    expect(formatPhone('2214567890')).toBe('2214567890');
    expect(formatPhone('no es un telefono')).toBe('no es un telefono');
  });
});
