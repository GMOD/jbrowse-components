/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import AnnotGrid from './AnnotGrid'

export default function VariantCsqPanel({
  feature,
  descriptions,
}: {
  feature: any
  descriptions: any
}) {
  const csqFields = (descriptions?.INFO?.CSQ?.Description?.match(
    /.*Format: (.*)/,
  )?.[1].split('|') || []) as string[]

  const csq = (feature.INFO.CSQ || []) as string[]
  const rows =
    csq.map((elt, id) => ({
      id,
      ...Object.fromEntries(elt.split('|').map((e, i) => [csqFields[i], e])),
    })) || []
  const columns = csqFields.map(c => ({
    field: c,
  }))
  return csq.length ? (
    <BaseCard title="CSQ table">
      <AnnotGrid rows={rows} columns={columns} />
    </BaseCard>
  ) : null
}
