import { Suspense, lazy } from 'react'

import { parseBreakend } from '@gmod/vcf'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import AltFormatter from './AltFormatter'
import Formatter from './Formatter'
import VariantSampleGrid from './VariantSampleGrid/VariantSampleGrid'
import { variantFieldDescriptions } from './variantFieldDescriptions'

import type { VariantFeatureWidgetModel } from './stateModelFactory'
import type { Descriptions, ReducedFeature } from './types'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// lazies
const LaunchBreakendPanel = lazy(
  () => import('./LaunchBreakendPanel/LaunchBreakendPanel'),
)
const VariantConsequenceDataGrid = lazy(
  () => import('./VariantConsequence/VariantConsequenceDataGrid'),
)

function AnnotationPanel({
  descriptions,
  feature,
  fieldKey,
  title,
  regex,
}: {
  descriptions?: Descriptions
  feature: SimpleFeatureSerialized & ReducedFeature
  fieldKey: 'ANN' | 'CSQ'
  title: string
  regex: RegExp
}) {
  const desc = descriptions?.INFO?.[fieldKey]?.Description
  const fields = desc?.match(regex)?.[1]?.split('|') || []
  const data = feature.INFO?.[fieldKey] || []
  return (
    <VariantConsequenceDataGrid fields={fields} data={data} title={title} />
  )
}

const svTypes = ['inversion', 'deletion', 'duplication', 'cnv', 'sv']

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
  ) : svTypes.some(t => type.includes(t)) ? (
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

const FeatDefined = observer(function (props: {
  feat: SimpleFeatureSerialized
  model: VariantFeatureWidgetModel
}) {
  const { feat, model } = props
  const { descriptions } = model
  const { samples, ...rest } = feat
  const { REF } = rest

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        descriptions={{
          ...variantFieldDescriptions,
          ...descriptions,
        }}
        formatter={(value, key) =>
          key === 'ALT' ? (
            <AltFormatter value={`${value}`} refString={REF as string} />
          ) : (
            <Formatter value={value} />
          )
        }
        {...props}
      />
      <Suspense fallback={null}>
        <AnnotationPanel
          feature={rest}
          descriptions={descriptions}
          fieldKey="CSQ"
          title="Variant CSQ field"
          regex={/.*Format: (.*)/}
        />
        <AnnotationPanel
          feature={rest}
          descriptions={descriptions}
          fieldKey="ANN"
          title="Variant ANN field"
          regex={/.*Functional annotations:'(.*)'$/}
        />
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

const VariantFeatureWidget = observer(function (props: {
  model: VariantFeatureWidgetModel
}) {
  const { model } = props
  const { featureData } = model
  const feat = structuredClone(featureData)

  return feat ? (
    <FeatDefined feat={feat} {...props} />
  ) : (
    <div>
      No feature loaded, may not be available after page refresh because it was
      too large for localStorage
    </div>
  )
})

export default VariantFeatureWidget
