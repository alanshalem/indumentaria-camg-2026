import { describe, expect, it } from 'vitest';
import {
  backorderOf,
  isOnDemand,
  ON_DEMAND_NOTICE,
  sameVariant,
  unitsFor,
  type StockLevel,
} from '../shared/domain/stock';

const stock: StockLevel[] = [
  { size: 'M', color: 'Roja', units: 3 },
  { size: 'M', color: 'Blanca', units: 0 },
  { size: 'XL', color: null, units: 5 },
];

describe('variantes', () => {
  it('el mismo talle en distinto color es otra variante', () => {
    // Es el nucleo del modelo: descontar una remera roja del contador de las
    // blancas dejaria el inventario mintiendo.
    expect(unitsFor(stock, 'M', 'Roja')).toBe(3);
    expect(unitsFor(stock, 'M', 'Blanca')).toBe(0);
  });

  it('el color ausente y el vacio son la misma variante', () => {
    expect(sameVariant({ size: 'XL', color: null }, { size: 'XL', color: '' })).toBe(true);
    expect(sameVariant({ size: 'XL', color: null }, { size: 'XL', color: 'Roja' })).toBe(false);
  });
});

describe('sin stock cargado no es lo mismo que sin stock', () => {
  it('una variante que el club nunca cargo devuelve null', () => {
    expect(unitsFor(stock, 'S', null)).toBeNull();
  });

  it('null no dispara el aviso: no controlar no es estar agotado', () => {
    // Sin esta distincion, activar el inventario habria puesto todo el catalogo
    // en "a pedido" antes de que el club cargara una sola unidad.
    expect(isOnDemand(stock, 'S', null)).toBe(false);
  });

  it('cero si lo dispara', () => {
    expect(isOnDemand(stock, 'M', 'Blanca')).toBe(true);
  });

  it('con unidades disponibles no avisa nada', () => {
    expect(isOnDemand(stock, 'M', 'Roja')).toBe(false);
    expect(isOnDemand(stock, 'XL', null)).toBe(false);
  });
});

describe('cuanto sale a pedido', () => {
  it('lo que excede el stock', () => {
    expect(backorderOf(2, 5)).toBe(3);
  });

  it('nada cuando alcanza', () => {
    expect(backorderOf(5, 2)).toBe(0);
    expect(backorderOf(2, 2)).toBe(0);
  });

  it('todo cuando esta agotada', () => {
    expect(backorderOf(0, 3)).toBe(3);
  });

  it('nada cuando la variante no se controla', () => {
    expect(backorderOf(null, 3)).toBe(0);
  });
});

describe('el mensaje al socio', () => {
  it('es uno solo y dice el plazo', () => {
    // Vive en un solo lugar: lo usan la card, la ficha, el mail y el panel.
    expect(ON_DEMAND_NOTICE).toBe('Disponible a pedido. Entrega estimada de 10 a 15 días.');
  });
});
