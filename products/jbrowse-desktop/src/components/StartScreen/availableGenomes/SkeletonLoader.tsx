import { Skeleton } from '@mui/material'

const headerWidths = [120, 100, 80, 140, 160]
const rowWidths = ['100%', '80%', '60%', '90%', '70%']

export default function SkeletonLoader() {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {headerWidths.map(w => (
            <th key={w} style={{ padding: '2px 4px' }}>
              <Skeleton width={w} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 10 }, (_, i) => (
          <tr key={i}>
            {rowWidths.map(w => (
              <td key={w} style={{ padding: '2px 4px' }}>
                <Skeleton width={w} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
