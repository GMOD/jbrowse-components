import React from 'react'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import AnnotGrid from './AnnotGrid'

export default function VariantAnnotationTable({
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
      <AnnotGrid
        rows={data.map((elt, id) => ({
          id,
          ...Object.fromEntries(elt.split('|').map((e, i) => [fields[i], e])),
        }))}
        columns={fields.map(c => ({ field: c }))}
      />
    </BaseCard>
  ) : null
}
