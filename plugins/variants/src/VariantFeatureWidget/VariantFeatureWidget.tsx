import { Suspense, lazy } from 'react'

import { parseBreakend } from '@gmod/vcf'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import VariantSampleGrid from './VariantSampleGrid'
import { variantFieldDescriptions } from './variantFieldDescriptions'

import type { VariantFeatureWidgetModel } from './stateModelFactory'
import type { Descriptions, ReducedFeature } from './types'

// lazies
const LaunchBreakendPanel = lazy(() => import('./LaunchBreakendPanel'))
const VariantConsequenceDataGrid = lazy(
  () => import('./VariantConsequenceDataGrid'),
)

function AnnPanel({
  descriptions,
  feature,
}: {
  descriptions?: Descriptions
  feature: ReducedFeature
}) {
  const annDesc = descriptions?.INFO?.ANN?.Description
  const annFields =
    annDesc?.match(/.*Functional annotations:'(.*)'$/)?.[1]?.split('|') || []
  const ann = feature.INFO?.ANN || []
  return (
    <VariantConsequenceDataGrid
      fields={annFields}
      data={ann}
      title="Variant ANN field"
    />
  )
}

function CsqPanel({
  descriptions,
  feature,
}: {
  descriptions?: Descriptions
  feature: ReducedFeature
}) {
  const csqDescription = descriptions?.INFO?.CSQ?.Description
  const csqFields =
    csqDescription?.match(/.*Format: (.*)/)?.[1]?.split('|') || []
  const csq = feature.INFO?.CSQ || []
  return (
    <VariantConsequenceDataGrid
      fields={csqFields}
      data={csq}
      title="Variant CSQ field"
    />
  )
}

function LaunchBreakendWidgetArea({
  model,
}: {
  model: VariantFeatureWidgetModel
}) {
  const { featureData } = model
  const feat = JSON.parse(JSON.stringify(featureData))
  const { type = '' } = feat

  return type === 'breakend' ? (
    <LaunchBreakendPanel
      feature={feat}
      locStrings={feat.ALT.map(
        (alt: string) => parseBreakend(alt)?.MatePosition || '',
      )}
      model={model}
    />
  ) : type === 'translocation' ? (
    <LaunchBreakendPanel
      feature={feat}
      model={model}
      locStrings={[`${feat.INFO.CHR2[0]}:${feat.INFO.END}`]}
    />
  ) : type === 'paired_feature' ? (
    <LaunchBreakendPanel
      feature={feat}
      model={model}
      locStrings={[`${feat.mate.refName}:${feat.mate.start}`]}
    />
  ) : type.includes('inversion') ||
    type.includes('deletion') ||
    type.includes('duplication') ||
    type.includes('cnv') ||
    type.includes('sv') ? (
    <LaunchBreakendPanel
      feature={{
        uniqueId: 'random',
        refName: feat.refName,
        start: feat.start,
        end: feat.start + 1,
        mate: {
          refName: feat.refName,
          start: feat.end,
          end: feat.end + 1,
        },
      }}
      model={model}
      locStrings={[`${feat.refName}:${feat.end}`]}
    />
  ) : null
}

const VariantFeatureWidget = observer(function (props: {
  model: VariantFeatureWidgetModel
}) {
  const { model } = props
  const { featureData, descriptions } = model
  const feat = JSON.parse(JSON.stringify(featureData))
  const { samples, ALT, ...rest } = feat

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        descriptions={{
          ...variantFieldDescriptions,
          ...descriptions,
        }}
        {...props}
      />
      <Suspense fallback={null}>
        <CsqPanel feature={rest} descriptions={descriptions} />
        <AnnPanel feature={rest} descriptions={descriptions} />
        <LaunchBreakendWidgetArea model={model} />
      </Suspense>
      <VariantSampleGrid
        feature={feat}
        {...props}
        descriptions={descriptions}
      />
    </Paper>
  )
})

export default VariantFeatureWidget
