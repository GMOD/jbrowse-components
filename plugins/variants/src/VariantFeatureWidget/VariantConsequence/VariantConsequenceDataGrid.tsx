import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

import VariantConsequenceDataGridWrapper from './VariantConsequenceDataGridWrapper.tsx'

export default function VariantConsequenceDataGrid({
  data,
  fields,
  title,
}: {
  data: string[]
  fields: string[]
  title: string
}) {
  return data.length ? (
    <BaseCard title={title}>
      <VariantConsequenceDataGridWrapper
        rows={data.map((elt, id) => {
          const parts = elt.split('|')
          const row: Record<string, string> = { id: `${id}` }
          fields.forEach((field, i) => {
            row[field] = parts[i] ?? ''
          })
          return row
        })}
        columns={fields.map(c => ({ field: c }))}
      />
    </BaseCard>
  ) : null
}
