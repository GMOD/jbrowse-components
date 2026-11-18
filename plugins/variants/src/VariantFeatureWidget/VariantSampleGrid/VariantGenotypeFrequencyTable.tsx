import DetailTable from '@jbrowse/core/ui/DetailTable'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox } from '@mui/material'
import { observer } from 'mobx-react'

import type { VariantSampleGridRow } from './types.ts'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

interface GenotypeRow {
  id: string
  GT: string
  genotype: string
  count: number
}

const useStyles = makeStyles()({
  checkbox: {
    padding: 0,
    '& svg': { width: '1.15rem', height: '1.15rem' },
  },
})

function tallyGenotypes(rows: VariantSampleGridRow[]) {
  const tally = new Map<string, GenotypeRow>()
  for (const { GT, genotype } of rows) {
    const entry = tally.get(GT)
    if (entry) {
      entry.count++
    } else {
      tally.set(GT, { id: GT, GT, genotype, count: 1 })
    }
  }
  return [...tally.values()]
}

const VariantGenotypeFrequencyTable = observer(
  function VariantGenotypeFrequencyTable({
    rows,
    title,
    selectedGenotypes,
    setSelectedGenotypes,
  }: {
    rows: VariantSampleGridRow[]
    title: React.ReactNode
    selectedGenotypes: Set<string> | null
    setSelectedGenotypes: (v: Set<string> | null) => void
  }) {
    const { classes } = useStyles()
    const total = rows.length
    const genotypeRows = tallyGenotypes(rows)
    const isSelected = (row: GenotypeRow) =>
      selectedGenotypes === null || selectedGenotypes.has(row.GT)
    const selectedCount = genotypeRows.filter(isSelected).length

    // every genotype selected is the same view as none filtered, so it
    // collapses to "no filter" rather than a count of n of n
    const select = (genotypes: Set<string>) => {
      setSelectedGenotypes(
        genotypes.size === genotypeRows.length ? null : genotypes,
      )
    }
    const toggle = (row: GenotypeRow) => {
      const next = new Set(genotypeRows.filter(isSelected).map(r => r.GT))
      if (next.has(row.GT)) {
        next.delete(row.GT)
      } else {
        next.add(row.GT)
      }
      select(next)
    }
    const showOnly = (row: GenotypeRow) => {
      select(
        selectedGenotypes?.size === 1 && selectedGenotypes.has(row.GT)
          ? new Set(genotypeRows.map(r => r.GT))
          : new Set([row.GT]),
      )
    }

    const columns: DetailTableColumn<GenotypeRow>[] = [
      { field: 'GT', value: row => row.GT },
      {
        field: 'count',
        value: row => row.count,
        text: row => `${row.count} / ${total}`,
      },
      {
        field: 'frequency',
        value: row => row.count,
        text: row => `${((row.count / total) * 100).toPrecision(3)}%`,
      },
      { field: 'genotype', value: row => row.genotype },
    ]

    return (
      <DetailTable
        title={title}
        exportName="genotype-frequencies"
        testId="variant-genotype-table"
        rows={genotypeRows}
        columns={columns}
        isRowSelected={row => selectedGenotypes !== null && isSelected(row)}
        onRowClick={showOnly}
        leading={{
          width: 40,
          header: (
            <Checkbox
              size="small"
              className={classes.checkbox}
              checked={selectedCount === genotypeRows.length}
              indeterminate={
                selectedCount > 0 && selectedCount < genotypeRows.length
              }
              onChange={() => {
                select(
                  selectedCount === genotypeRows.length
                    ? new Set()
                    : new Set(genotypeRows.map(r => r.GT)),
                )
              }}
              slotProps={{ input: { 'aria-label': 'Select all genotypes' } }}
            />
          ),
          cell: row => (
            <Checkbox
              size="small"
              className={classes.checkbox}
              checked={isSelected(row)}
              onClick={event => {
                event.stopPropagation()
              }}
              onChange={() => {
                toggle(row)
              }}
              slotProps={{ input: { 'aria-label': `Select ${row.GT}` } }}
            />
          ),
        }}
      />
    )
  },
)

export default VariantGenotypeFrequencyTable
