import { useState } from 'react'

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
}: {
  rows: VariantSampleGridRow[]
}) {
  const [useCounts, setUseCounts] = useState(false)

  const summary = {} as FrequencyTable
  if (!useCounts) {
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
  } else {
    for (const row of rows) {
      const alleleCounts = {} as Record<string, number>
      const alleles = row.GT.split(/[/|]/)
      for (const allele of alleles) {
        alleleCounts[allele] = (alleleCounts[allele] || 0) + 1
      }
      const key = Object.entries(alleleCounts)
        .map(([key, val]) => `${key}:${val}`)
        .join(';')

      if (!summary[key]) {
        summary[key] = {
          count: 0,
          GT: key,
          genotype: row.genotype,
        }
      }
      summary[key].count++
    }
  }
  const gridRows = Object.entries(summary).map(([key, val]) => ({
    id: key,
    ...val,
    count: `${val.count} / ${rows.length}`,
    frequency: `${toP((val.count / rows.length) * 100)}%`,
  }))

  const keys = gridRows[0] ? Object.keys(gridRows[0]) : []
  const widths = keys.map(e =>
    measureGridWidth(gridRows.map(r => `${r[e as keyof typeof r]}`)),
  )

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
            {
              field: 'GT',
              width: widths[0],
            },
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
        />
      </DataGridFlexContainer>
    </div>
  )
}
