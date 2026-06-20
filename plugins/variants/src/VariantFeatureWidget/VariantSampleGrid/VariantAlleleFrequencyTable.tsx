import { measureGridWidth } from '@jbrowse/core/util'
import { DataGrid } from '@mui/x-data-grid'

import type { AlleleFrequency } from './types.ts'

export default function VariantAlleleFrequencyTable({
  frequencies,
}: {
  frequencies: AlleleFrequency[]
}) {
  const height = 25 + frequencies.length * 25 + 15
  return (
    <div style={{ height }}>
      <DataGrid
        rows={frequencies}
        hideFooter
        rowHeight={25}
        columnHeaderHeight={25}
        columns={[
          {
            field: 'allele',
            headerName: 'Allele',
            width: measureGridWidth(frequencies.map(r => r.allele)),
          },
          {
            field: 'count',
            headerName: 'Count',
            width: measureGridWidth(frequencies.map(r => r.count)),
          },
          {
            field: 'frequency',
            headerName: 'Frequency',
            width: measureGridWidth(frequencies.map(r => r.frequency)),
          },
        ]}
      />
    </div>
  )
}
