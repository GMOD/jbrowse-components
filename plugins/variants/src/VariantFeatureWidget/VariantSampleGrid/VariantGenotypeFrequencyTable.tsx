import { ErrorMessage } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { measureGridWidth } from '@jbrowse/core/util'
import { DataGrid } from '@mui/x-data-grid'

import FlexContainer from './FlexContainer'

import type { FrequencyTable } from './types'

const toP = (s = 0) => +(+s).toFixed(2)

export default function VariantGenotypeFrequencyTable({
  summary,
  totalRows,
}: {
  summary: FrequencyTable
  totalRows: number
}) {
  const rows = Object.entries(summary).map(([key, val]) => ({
    id: key,
    GT: val.GT,
    genotype: val.genotype,
    count: `${val.count} / ${totalRows}`,
    frequency: `${toP(val.count / totalRows)}%`,
  }))
  const keys = ['GT', 'count', 'frequency', 'genotype']
  const widths = keys.map(e =>
    measureGridWidth(rows.map(r => `${r[e as keyof typeof r]}`)),
  )

  return (
    <ErrorBoundary FallbackComponent={ErrorMessage}>
      <FlexContainer>
        <DataGrid
          rows={rows}
          hideFooter
          columns={[
            { field: 'GT', width: widths[0] },
            {
              field: 'count',
              width: widths[1],
            },
            {
              field: 'frequency',
              width: widths[2],
            },
            {
              field: 'genotype',
              width: widths[3],
            },
          ]}
          disableRowSelectionOnClick
          rowHeight={25}
          columnHeaderHeight={35}
        />
      </FlexContainer>
    </ErrorBoundary>
  )
}
