import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

import VariantConsequenceDataGridWrapper from './VariantConsequenceDataGridWrapper'

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
        rows={data.map((elt, id) => ({
          id,
          ...Object.fromEntries(elt.split('|').map((e, i) => [fields[i], e])),
        }))}
        columns={fields.map(c => ({ field: c }))}
      />
    </BaseCard>
  ) : null
}
