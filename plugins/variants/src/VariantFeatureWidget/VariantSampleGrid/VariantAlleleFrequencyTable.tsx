import DetailTable from '@jbrowse/core/ui/DetailTable'
import { observer } from 'mobx-react'

import type { AlleleFrequency } from './types.ts'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

const columns: DetailTableColumn<AlleleFrequency>[] = [
  { field: 'allele', header: 'Allele', sortValue: row => row.allele },
  { field: 'count', header: 'Count', sortValue: row => row.count },
  {
    field: 'frequency',
    header: 'Frequency',
    sortValue: row => row.count,
    text: row => row.frequency,
  },
]

const VariantAlleleFrequencyTable = observer(
  function VariantAlleleFrequencyTable({
    frequencies,
    title,
  }: {
    frequencies: AlleleFrequency[]
    title: React.ReactNode
  }) {
    return (
      <DetailTable
        title={title}
        exportName="allele-frequencies"
        testId="variant-allele-table"
        rows={frequencies}
        columns={columns}
      />
    )
  },
)

export default VariantAlleleFrequencyTable
