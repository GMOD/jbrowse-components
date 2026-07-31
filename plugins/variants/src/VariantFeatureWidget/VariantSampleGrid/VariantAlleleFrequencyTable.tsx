import { DataGrid } from '@mui/x-data-grid'

import { measuredColumns } from '../measuredColumns.ts'

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
        columns={measuredColumns(frequencies, [
          { field: 'allele', headerName: 'Allele' },
          { field: 'count', headerName: 'Count' },
          { field: 'frequency', headerName: 'Frequency' },
        ])}
      />
    </div>
  )
}
