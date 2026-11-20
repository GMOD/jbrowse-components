import DetailTable from '@jbrowse/core/ui/DetailTable'
import { observer } from 'mobx-react'

import { mendelianName } from '../shared/trios.ts'

import type { TrioCall } from '../shared/trios.ts'
import type { DetailTableColumn } from '@jbrowse/core/ui/DetailTable'

type TrioCallRow = TrioCall & { id: string }

const columns: DetailTableColumn<TrioCallRow>[] = [
  { field: 'child', value: row => row.child },
  { field: 'father', value: row => row.father ?? '' },
  { field: 'mother', value: row => row.mother ?? '' },
  { field: 'sex', value: row => row.sex ?? '' },
  {
    field: 'call',
    header: 'Mendelian check',
    value: row => (row.call === undefined ? '' : mendelianName(row.call)),
  },
]

/** Each trio's Mendelian check at the record, from its full genotypes. */
const TrioCallsTable = observer(function TrioCallsTable({
  trioCalls,
}: {
  trioCalls: readonly TrioCall[]
}) {
  return (
    <DetailTable
      title="Mendelian check"
      exportName="mendelian-check"
      testId="variant-trio-calls"
      rows={trioCalls.map(call => ({ ...call, id: call.child }))}
      columns={columns}
    />
  )
})

export default TrioCallsTable
