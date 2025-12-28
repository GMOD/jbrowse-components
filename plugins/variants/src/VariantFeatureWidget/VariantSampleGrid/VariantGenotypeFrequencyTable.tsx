import DataGridFlexContainer from '@jbrowse/core/ui/DataGridFlexContainer'
import { measureGridWidth } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import type { FrequencyTable, VariantSampleGridRow } from './types'

function toP(n: number) {
  return n.toPrecision(3)
}

export default function VariantGenotypeFrequencyTable({
  rows,
  useCounts,
  setUseCounts,
}: {
  rows: VariantSampleGridRow[]
  useCounts: boolean
  setUseCounts: (v: boolean) => void
}) {
  const summary = {} as FrequencyTable
  for (const row of rows) {
    const gt = row.GT
    if (!summary[gt]) {
      summary[gt] = {
        count: 0,
        GT: row.GT,
        genotype: row.genotype,
      }
    }
    summary[gt].count++
  }
  const gridRows = Object.entries(summary).map(([key, val]) => ({
    id: key,
    ...val,
    count: `${val.count} / ${rows.length}`,
    frequency: `${toP((val.count / rows.length) * 100)}%`,
  }))

  return (
    <div>
      <FormControlLabel
        control={<Checkbox checked={useCounts} />}
        label={
          <Typography variant="body2">
            Use allele counts instead of exact GT
          </Typography>
        }
        onChange={(_, checked) => {
          setUseCounts(checked)
        }}
      />
      <DataGridFlexContainer>
        <DataGrid
          rows={gridRows}
          hideFooter
          rowHeight={25}
          columnHeaderHeight={35}
          columns={[
            { field: 'GT', width: measureGridWidth(gridRows.map(r => r.GT)) },
            {
              field: 'count',
              width: measureGridWidth(gridRows.map(r => r.count)),
            },
            {
              field: 'frequency',
              width: measureGridWidth(gridRows.map(r => r.frequency)),
            },
            {
              field: 'genotype',
              width: measureGridWidth(gridRows.map(r => r.genotype)),
            },
          ]}
        />
      </DataGridFlexContainer>
    </div>
  )
}
