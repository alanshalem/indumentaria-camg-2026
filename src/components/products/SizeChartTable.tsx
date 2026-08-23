import { rowForSize, type SizeChart } from '@shared/domain/sizeCharts';
import styles from './SizeChartTable.module.css';

interface Props {
  chart: SizeChart;
  /** Talle elegido en la ficha, para resaltar su fila. */
  highlight?: string;
}

/**
 * La tabla de talles como tabla de verdad.
 *
 * Antes eran números adentro de un JPG: en el teléfono no se leían, no se podían
 * agrandar y un lector de pantalla no los alcanzaba. Acá además se puede marcar
 * la fila del talle que el socio ya eligió, que es la única que le importa.
 */
export function SizeChartTable({ chart, highlight }: Props) {
  const active = highlight ? rowForSize(chart, highlight) : null;

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          Medidas de {chart.label.toLowerCase()} en centímetros
        </caption>
        <thead>
          <tr>
            <th scope="col">Talle</th>
            {chart.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => {
            const isActive = active?.size === row.size;
            return (
              <tr key={row.size} className={isActive ? styles.active : undefined}>
                <th scope="row">
                  {row.size}
                  {isActive && <span className={styles.tag}>tu talle</span>}
                </th>
                {row.measurements.map((value, index) => (
                  <td key={chart.columns[index] ?? index}>{value}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
