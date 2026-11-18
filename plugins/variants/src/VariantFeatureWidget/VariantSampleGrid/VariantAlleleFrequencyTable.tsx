import DetailTable from '@jbrowse/core/ui/DetailTable'
import { observer } from 'mobx-react'

import type { AlleleFrequency } from './types.ts'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

const columns: DetailTableColumn<AlleleFrequency>[] = [
  { field: 'allele', header: 'Allele', value: row => row.allele },
  { field: 'count', header: 'Count', value: row => row.count },
  { field: 'frequency', header: 'Frequency', value: row => row.frequency },
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
        rows={frequencies}
        columns={columns}
      />
    )
  },
)

export default VariantAlleleFrequencyTable
