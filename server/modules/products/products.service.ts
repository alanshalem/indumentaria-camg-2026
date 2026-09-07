import { resolveProductId, type Product, type ProductInput } from '../../../shared/domain/product.js';
import type { StockLevel } from '../../../shared/domain/stock.js';
import { productRepository, type ProductRepository } from '../../infra/productRepository.js';
import { conflict, validationError } from '../../http/errors.js';

export interface ProductsService {
  list(includeInactive: boolean): Promise<Product[]>;
  create(input: Required<Omit<ProductInput, 'id'>> & { id?: string }): Promise<Product>;
  update(id: string, patch: Partial<ProductInput>): Promise<Product>;
  /** Reemplaza la grilla de stock del producto. */
  setStock(id: string, levels: readonly StockLevel[]): Promise<Product>;
  remove(id: string): Promise<void>;
}

/**
 * Fábrica con la dependencia inyectada: en producción recibe el repositorio
 * de Supabase, en tests un doble en memoria. Sin `new` ni contenedores de DI.
 */
export function createProductsService(repository: ProductRepository = productRepository): ProductsService {
  return {
    list: (includeInactive) => repository.list({ includeInactive }),

    async create(input) {
      const id = resolveProductId(input);
      if (!id) throw validationError('El nombre no genera un identificador válido.');

      if (await repository.findById(id)) {
        throw conflict(`Ya existe un producto con el identificador "${id}".`);
      }

      const { id: _ignored, ...attributes } = input;
      return repository.create(id, attributes);
    },

    async update(id, patch) {
      // El id es la clave primaria y queda referenciado en pedidos históricos:
      // renombrarlo rompería la trazabilidad, así que se ignora en el patch.
      const { id: _ignored, ...attributes } = patch;
      return repository.update(id, attributes);
    },

    setStock: (id, levels) => repository.setStock(id, levels),

    remove: (id) => repository.remove(id),
  };
}

export const productsService = createProductsService();
