import { describe, expect, it } from 'vitest';
import { suggestEmailFix } from '../shared/domain/emailSuggestion';

describe('suggestEmailFix', () => {
  it('corrige los typos más comunes de gmail', () => {
    expect(suggestEmailFix('ana@gmial.com')).toBe('ana@gmail.com');
    expect(suggestEmailFix('ana@gmai.com')).toBe('ana@gmail.com');
    expect(suggestEmailFix('ana@gmail.con')).toBe('ana@gmail.com');
    expect(suggestEmailFix('ana@gmail.co')).toBe('ana@gmail.com');
  });

  it('corrige typos de hotmail y outlook', () => {
    expect(suggestEmailFix('ana@hotmial.com')).toBe('ana@hotmail.com');
    expect(suggestEmailFix('ana@hotmail.co')).toBe('ana@hotmail.com');
    expect(suggestEmailFix('ana@outlok.com')).toBe('ana@outlook.com');
  });

  it('no sugiere nada si el dominio ya está bien', () => {
    for (const email of [
      'ana@gmail.com',
      'ana@hotmail.com.ar',
      'ana@outlook.com',
      'ana@icloud.com',
    ]) {
      expect(suggestEmailFix(email)).toBeNull();
    }
  });

  it('no toca dominios propios que no se parecen a ninguno conocido', () => {
    // Un mail corporativo válido no puede quedar marcado como error.
    expect(suggestEmailFix('info@clubatleticomontegrande.com.ar')).toBeNull();
    expect(suggestEmailFix('ana@empresa.com.ar')).toBeNull();
    expect(suggestEmailFix('ana@universidad.edu.ar')).toBeNull();
  });

  it('no adivina con dominios demasiado cortos', () => {
    // "me.com" o "aa.co" se parecen a demasiadas cosas: sugerir seria inventar.
    expect(suggestEmailFix('ana@aa.co')).toBeNull();
  });

  it('respeta la parte local del mail', () => {
    expect(suggestEmailFix('nombre.apellido+etiqueta@gmial.com')).toBe(
      'nombre.apellido+etiqueta@gmail.com',
    );
  });

  it('normaliza mayúsculas y espacios', () => {
    expect(suggestEmailFix('  ANA@GMIAL.COM  ')).toBe('ana@gmail.com');
  });

  it('devuelve null con entradas que no son un mail', () => {
    for (const value of ['', 'ana', 'ana@', '@gmail.com', 'sin arroba']) {
      expect(suggestEmailFix(value)).toBeNull();
    }
  });
});
