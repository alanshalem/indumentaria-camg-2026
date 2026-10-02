/**
 * Las columnas de la tabla de pedidos, declaradas una sola vez.
 *
 * La cabecera listaba nueve `<th>` a mano y la fila del detalle usaba
 * `colSpan={9}`. Los dos números tenían que coincidir y nada los relacionaba:
 * agregar una columna —lo que pasó con la de método de pago— desalineaba el
 * detalle sin que fallara ningún test ni se quejara el compilador.
 *
 * Ahora la cabecera se recorre de acá y el `colSpan` es `ORDER_COLUMNS.length`.
 */
export interface OrderColumn {
  /** Vacío en la columna de acciones: el `<th>` va sin texto. */
  label: string;
  /** Los números van a la derecha para que se puedan comparar de un vistazo. */
  align?: 'right';
}

export const ORDER_COLUMNS: readonly OrderColumn[] = [
  { label: 'Código' },
  { label: 'Fecha' },
  { label: 'Socio' },
  { label: 'Contacto' },
  { label: 'Items', align: 'right' },
  { label: 'Total', align: 'right' },
  { label: 'Pago' },
  { label: 'Estado' },
  { label: '' },
];
