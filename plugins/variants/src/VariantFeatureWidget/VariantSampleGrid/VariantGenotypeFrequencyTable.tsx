import { measureGridWidth, resolveSelectedIds } from '@jbrowse/core/util'
import { DataGrid } from '@mui/x-data-grid'

import type { FrequencyTable, VariantSampleGridRow } from './types.ts'

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
  const summary: FrequencyTable = {}
  for (const row of rows) {
    const gt = row.GT
    summary[gt] ??= {
      count: 0,
      GT: row.GT,
      genotype: row.genotype,
    }
    summary[gt].count++
  }
  const gridRows = Object.entries(summary).map(([key, val]) => ({
    id: key,
    ...val,
    count: `${val.count} / ${rows.length}`,
    frequency: `${((val.count / rows.length) * 100).toPrecision(3)}%`,
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
          const ids = resolveSelectedIds(
            newSelection,
            gridRows.map(r => r.id),
          )
          // every genotype selected is the same view as none selected, so
          // collapse it to "no filter" instead of a count of n of n
          setSelectedGenotypes(
            ids.size === gridRows.length
              ? null
              : new Set(gridRows.filter(r => ids.has(r.id)).map(r => r.GT)),
          )
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
