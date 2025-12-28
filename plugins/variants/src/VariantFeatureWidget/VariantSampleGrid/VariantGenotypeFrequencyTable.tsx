import { measureGridWidth } from '@jbrowse/core/util'
import { Checkbox } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

import type { FrequencyTable, VariantSampleGridRow } from './types'

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

  const allSelected =
    selectedGenotypes === null ||
    gridRows.every(r => selectedGenotypes.has(r.GT))

  const height = 25 + gridRows.length * 25 + 15 + (showToolbar ? 40 : 0)

  return (
    <div style={{ height }}>
      <DataGrid
        rows={gridRows}
        hideFooter
        rowHeight={25}
        columnHeaderHeight={25}
        columns={[
          {
            field: 'select',
            headerName: '',
            width: 27,
            sortable: false,
            disableColumnMenu: true,
            renderHeader: () => (
              <Checkbox
                checked={allSelected}
                indeterminate={
                  selectedGenotypes !== null &&
                  selectedGenotypes.size > 0 &&
                  selectedGenotypes.size < gridRows.length
                }
                onChange={(_, checked) => {
                  if (checked) {
                    setSelectedGenotypes(null)
                  } else {
                    setSelectedGenotypes(new Set())
                  }
                }}
                size="small"
              />
            ),
            renderCell: params => {
              const isChecked =
                selectedGenotypes === null ||
                selectedGenotypes.has(params.row.GT)
              return (
                <Checkbox
                  checked={isChecked}
                  onChange={(_, checked) => {
                    const newSet = new Set(
                      selectedGenotypes === null
                        ? gridRows.map(r => r.GT)
                        : selectedGenotypes,
                    )
                    if (checked) {
                      newSet.add(params.row.GT)
                    } else {
                      newSet.delete(params.row.GT)
                    }
                    if (newSet.size === gridRows.length) {
                      setSelectedGenotypes(null)
                    } else {
                      setSelectedGenotypes(newSet)
                    }
                  }}
                  size="small"
                />
              )
            },
          },
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
