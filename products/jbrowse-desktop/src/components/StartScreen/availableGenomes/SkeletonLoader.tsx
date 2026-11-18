import {
  CELL_PADDING,
  HEADER_HEIGHT,
  ROW_HEIGHT,
} from '@jbrowse/core/ui/VirtualTable'
import { Skeleton } from '@mui/material'
import { observer } from 'mobx-react'

const cellStyle = { padding: CELL_PADDING }

// Widths cycle so the placeholder reads as text rather than a uniform grid.
const headerWidths = [120, 100, 80, 140, 160]
const rowWidths = ['100%', '80%', '60%', '90%', '70%']

const SkeletonLoader = observer(function SkeletonLoader({
  columnCount,
}: {
  columnCount: number
}) {
  const cols = Array.from({ length: columnCount }, (_, i) => i)
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ height: HEADER_HEIGHT }}>
          {cols.map(i => (
            <th key={i} style={cellStyle}>
              <Skeleton width={headerWidths[i % headerWidths.length]} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 10 }, (_, row) => (
          <tr key={row} style={{ height: ROW_HEIGHT }}>
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
})

export default SkeletonLoader
