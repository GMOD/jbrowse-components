import { measureGridWidth } from '@jbrowse/core/util'
import { DataGrid } from '@mui/x-data-grid'

import type { FrequencyTable, VariantSampleGridRow } from './types.ts'

function toP(n: number) {
  return n.toPrecision(3)
}

export default function VariantGenotypeFrequencyTable({
  rows,
  selectedGenotypes,
  setSelectedGenotypes,
  showToolbar,
}: {
  rows: VariantSampleGridRow[]
  selectedGenotypes: Set<string> | null
  setSelectedGenotypes: (v: Set<string> | null) => void
  showToolbar?: boolean
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

  const rowSelectionModel =
    selectedGenotypes === null
      ? { type: 'exclude' as const, ids: new Set<string>() }
      : {
          type: 'include' as const,
          ids: new Set(
            gridRows.filter(r => selectedGenotypes.has(r.GT)).map(r => r.id),
          ),
        }

  const height = 25 + gridRows.length * 25 + 15 + (showToolbar ? 40 : 0)

  return (
    <div style={{ height }}>
      <DataGrid
        rows={gridRows}
        hideFooter
        rowHeight={25}
        columnHeaderHeight={25}
        checkboxSelection
        rowSelectionModel={rowSelectionModel}
        onRowSelectionModelChange={newSelection => {
          if (newSelection.type === 'exclude' && newSelection.ids.size === 0) {
            setSelectedGenotypes(null)
          } else if (newSelection.type === 'include') {
            setSelectedGenotypes(
              new Set(
                gridRows.filter(r => newSelection.ids.has(r.id)).map(r => r.GT),
              ),
            )
          } else {
            setSelectedGenotypes(
              new Set(
                gridRows
                  .filter(r => !newSelection.ids.has(r.id))
                  .map(r => r.GT),
              ),
            )
          }
        }}
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
        showToolbar={showToolbar}
      />
    </div>
  )
}
