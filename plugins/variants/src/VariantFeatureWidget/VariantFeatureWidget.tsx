import React, { lazy, Suspense } from 'react'
import { parseBreakend } from '@gmod/vcf'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import VariantAnnotationTable from './VariantAnnotationTable'
import VariantSampleGrid from './VariantSampleGrid'
import { variantFieldDescriptions } from './variantFieldDescriptions'
import type { VariantFeatureWidgetModel } from './stateModelFactory'

// lazies
const LaunchBreakendPanel = lazy(() => import('./LaunchBreakendPanel'))

function AnnPanel({
  descriptions,
  feature,
}: {
  descriptions?: {
    INFO?: {
      ANN?: {
        Description?: string
      }
    }
  }
  feature: {
    INFO?: {
      ANN?: string[]
    }
  }
}) {
  const annDesc = descriptions?.INFO?.ANN?.Description
  const annFields =
    annDesc?.match(/.*Functional annotations:'(.*)'$/)?.[1]?.split('|') || []
  const ann = feature.INFO?.ANN || []
  return (
    <VariantAnnotationTable
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
  descriptions?: { INFO?: { CSQ?: { Description?: string } } }
  feature: { INFO?: { CSQ?: string[] } }
}) {
  const csqDescription = descriptions?.INFO?.CSQ?.Description
  const csqFields =
    csqDescription?.match(/.*Format: (.*)/)?.[1]?.split('|') || []
  const csq = feature.INFO?.CSQ || []
  return (
    <VariantAnnotationTable
      fields={csqFields}
      data={csq}
      title="Variant CSQ field"
    />
  )
}

const VariantFeatureWidget = observer(function (props: {
  model: VariantFeatureWidgetModel
}) {
  const { model } = props
  const { featureData, descriptions } = model
  const feat = JSON.parse(JSON.stringify(featureData))
  const { samples, ALT, type = '', ...rest } = feat

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        descriptions={{ ...variantFieldDescriptions, ...descriptions }}
        {...props}
      />
      <CsqPanel feature={rest} descriptions={descriptions} />
      <AnnPanel feature={rest} descriptions={descriptions} />
      <Suspense fallback={null}>
        {type === 'breakend' ? (
          <LaunchBreakendPanel
            feature={feat}
            locStrings={feat.ALT.map(
              (alt: string) => parseBreakend(alt)?.MatePosition || '',
            )}
            model={model}
          />
        ) : null}
        {type === 'translocation' ? (
          <LaunchBreakendPanel
            feature={feat}
            model={model}
            locStrings={[`${feat.INFO.CHR2[0]}:${feat.INFO.END}`]}
          />
        ) : null}
        {type === 'paired_feature' ? (
          <LaunchBreakendPanel
            feature={feat}
            model={model}
            locStrings={[`${feat.mate.refName}:${feat.mate.start}`]}
          />
        ) : null}
        {type.includes('inversion') ||
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
        ) : null}
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
