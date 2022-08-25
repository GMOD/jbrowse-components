/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import AnnotGrid from './AnnotGrid'

export default function VariantAnnPanel({
  feature,
  descriptions,
}: {
  feature: any
  descriptions: any
}) {
  const annFields = (descriptions?.INFO?.ANN?.Description?.match(
    /.*Functional annotations:'(.*)'$/,
  )?.[1].split('|') || []) as string[]
  const ann = (feature.INFO.ANN || []) as string[]

  const rows =
    ann.map((elt, id) => ({
      id,
      ...Object.fromEntries(elt.split('|').map((e, i) => [annFields[i], e])),
    })) || []
  const columns = annFields.map(c => ({
    field: c,
  }))
  return ann.length ? (
    <BaseCard title="ANN table">
      <AnnotGrid rows={rows} columns={columns} />
    </BaseCard>
  ) : null
}
