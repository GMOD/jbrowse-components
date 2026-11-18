import { observer } from 'mobx-react'

import DetailTable from '../../ui/DetailTable/DetailTable.tsx'
import SanitizedHTML from '../../ui/SanitizedHTML.tsx'
import { getStr } from '../../util/getStr.ts'
import FieldName from './FieldName.tsx'

import type { DetailTableColumn } from '../../ui/DetailTable/DetailTable.tsx'

interface AttributeRow {
  id: number
  record: Record<string, unknown>
}

/**
 * An attribute holding an array of like objects, one row per object. Rows are
 * keyed by their index, so an object's own `id` stays one of its columns.
 */
const AttributeTable = observer(function AttributeTable({
  value,
  prefix,
  name,
}: {
  name: string
  prefix?: string[]
  value: Record<string, unknown>[]
}) {
  const rows = value.map((record, id) => ({ id, record }))
  const columns = [...new Set(value.flatMap(Object.keys))].map(
    field =>
      ({
        field,
        html: true,
        value: row => row.record[field],
        cell: row => <SanitizedHTML html={getStr(row.record[field] ?? '')} />,
      }) satisfies DetailTableColumn<AttributeRow>,
  )
  return (
    <DetailTable
      title={<FieldName prefix={prefix} name={name} />}
      exportName={[...(prefix ?? []), name].join('.')}
      rows={rows}
      columns={columns}
    />
  )
})

export default AttributeTable
