import { Skeleton } from '@mui/material'

const cellStyle = { padding: '2px 4px' }

// Widths cycle so the placeholder reads as text rather than a uniform grid.
const headerWidths = [120, 100, 80, 140, 160]
const rowWidths = ['100%', '80%', '60%', '90%', '70%']

// Takes the real column count so the layout does not jump when rows arrive.
export default function SkeletonLoader({
  columnCount,
}: {
  columnCount: number
}) {
  const cols = Array.from({ length: columnCount }, (_, i) => i)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {cols.map(i => (
            <th key={i} style={cellStyle}>
              <Skeleton width={headerWidths[i % headerWidths.length]} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 10 }, (_, row) => (
          <tr key={row}>
            {cols.map(i => (
              <td key={i} style={cellStyle}>
                <Skeleton width={rowWidths[(row + i) % rowWidths.length]} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
