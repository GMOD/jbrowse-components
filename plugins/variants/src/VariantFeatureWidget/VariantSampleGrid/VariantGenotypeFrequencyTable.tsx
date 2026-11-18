import DetailTable from '@jbrowse/core/ui/DetailTable'
import { checkboxLeading } from '@jbrowse/core/ui/VirtualTable'
import { observer } from 'mobx-react'

import type { VariantSampleGridRow } from './types.ts'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

interface GenotypeRow {
  id: string
  GT: string
  genotype: string
  count: number
}

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
    const total = rows.length
    const genotypeRows = tallyGenotypes(rows)
    const isSelected = (row: GenotypeRow) =>
      selectedGenotypes === null || selectedGenotypes.has(row.GT)
    // every genotype selected is the same view as none filtered, so it
    // collapses to "no filter" rather than a count of n of n
    const select = (genotypes: Set<string>) => {
      setSelectedGenotypes(
        genotypes.size === genotypeRows.length ? null : genotypes,
      )
    }
    const showOnly = (row: GenotypeRow) => {
      select(
        selectedGenotypes?.size === 1 && selectedGenotypes.has(row.GT)
          ? new Set(genotypeRows.map(r => r.GT))
          : new Set([row.GT]),
      )
    }

    const columns: DetailTableColumn<GenotypeRow>[] = [
      { field: 'GT', sortValue: row => row.GT },
      {
        field: 'count',
        sortValue: row => row.count,
        text: row => `${row.count} / ${total}`,
      },
      {
        field: 'frequency',
        sortValue: row => row.count,
        text: row => `${((row.count / total) * 100).toPrecision(3)}%`,
      },
      { field: 'genotype', sortValue: row => row.genotype },
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
        leading={checkboxLeading<GenotypeRow>({
          selected: new Set(genotypeRows.filter(isSelected).map(r => r.id)),
          onChange: select,
          label: row => `Select ${row.GT}`,
          allLabel: 'Select all genotypes',
        })}
      />
    )
  },
)

export default VariantGenotypeFrequencyTable
