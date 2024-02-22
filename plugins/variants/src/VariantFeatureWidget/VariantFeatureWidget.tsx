import React from 'react'
import { observer } from 'mobx-react'
import { Paper } from '@mui/material'
import { FeatureDetails } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { parseBreakend } from '@gmod/vcf'

// locals
import VariantSampleGrid from './VariantSampleGrid'
import BreakendPanel from './BreakendPanel'
import VariantAnnotationTable from './VariantAnnotationTable'
import { VariantFeatureWidgetModel } from './stateModelFactory'
import { variantFieldDescriptions } from './variantFieldDescriptions'

function AnnPanel({
  descriptions,
  feature,
}: {
  descriptions: { INFO?: { ANN?: { Description?: string } } }
  feature: { INFO?: { ANN?: string[] } }
}) {
  const annDesc = descriptions?.INFO?.ANN?.Description
  const annFields =
    annDesc?.match(/.*Functional annotations:'(.*)'$/)?.[1].split('|') || []
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
  descriptions: { INFO?: { CSQ?: { Description?: string } } }
  feature: { INFO?: { CSQ?: string[] } }
}) {
  const csqDescription = descriptions?.INFO?.CSQ?.Description
  const csqFields =
    csqDescription?.match(/.*Format: (.*)/)?.[1].split('|') || []
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
  const { samples, ...rest } = feat

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        descriptions={{ ...variantFieldDescriptions, ...descriptions }}
        {...props}
      />
      <CsqPanel feature={rest} descriptions={descriptions} />
      <AnnPanel feature={rest} descriptions={descriptions} />
      {feat.type === 'breakend' ? (
        <BreakendPanel
          feature={feat}
          locStrings={feat.ALT.map(
            (alt: string) => parseBreakend(alt)?.MatePosition || '',
          )}
          model={model}
        />
      ) : null}
      {feat.type === 'translocation' ? (
        <BreakendPanel
          feature={feat}
          model={model}
          locStrings={[`${feat.INFO.CHR2[0]}:${feat.INFO.END}`]}
        />
      ) : null}
      <VariantSampleGrid
        feature={feat}
        {...props}
        descriptions={descriptions}
      />
    </Paper>
  )
})

export default VariantFeatureWidget
