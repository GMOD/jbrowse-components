import { Suspense, lazy } from 'react'

import { parseBreakend } from '@gmod/vcf'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import Formatter from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Formatter'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import AltFormatter from './AltFormatter.tsx'
import VariantSampleGrid from './VariantSampleGrid/VariantSampleGrid.tsx'
import { variantFieldDescriptions } from './variantFieldDescriptions.ts'

import type { VariantFeatureWidgetModel } from './stateModelFactory.ts'
import type { Descriptions, VCFFeatureSerialized } from './types.ts'

// lazies
const LaunchBreakendPanel = lazy(
  () => import('./LaunchBreakendPanel/LaunchBreakendPanel.tsx'),
)
const VariantConsequenceDataGrid = lazy(
  () => import('./VariantConsequence/VariantConsequenceDataGrid.tsx'),
)

function AnnotationPanel({
  descriptions,
  feature,
  fieldKey,
  title,
  regex,
}: {
  descriptions?: Descriptions
  feature: VCFFeatureSerialized
  fieldKey: 'ANN' | 'CSQ'
  title: string
  regex: RegExp
}) {
  const desc = descriptions?.INFO?.[fieldKey]?.Description
  const fields = desc?.match(regex)?.[1]?.split('|') ?? []
  const data = feature.INFO?.[fieldKey] ?? []
  return (
    <VariantConsequenceDataGrid fields={fields} data={data} title={title} />
  )
}

const svTypes = ['inversion', 'deletion', 'duplication', 'cnv', 'sv']

function LaunchBreakendWidgetArea({
  model,
  feat,
}: {
  model: VariantFeatureWidgetModel
  feat: VCFFeatureSerialized
}) {
  const { type = '', ALT = [], INFO, mate, refName, start, end } = feat

  return type === 'breakend' ? (
    <LaunchBreakendPanel
      feature={feat}
      locStrings={ALT.map(alt => parseBreakend(alt)?.MatePosition || '')}
      model={model}
    />
  ) : type === 'translocation' && INFO?.CHR2 && INFO.END ? (
    <LaunchBreakendPanel
      feature={feat}
      model={model}
      locStrings={[`${INFO.CHR2[0]}:${INFO.END[0]}`]}
    />
  ) : type === 'paired_feature' && mate ? (
    <LaunchBreakendPanel
      feature={feat}
      model={model}
      locStrings={[`${mate.refName}:${mate.start}`]}
    />
  ) : svTypes.some(t => type.includes(t)) ? (
    <LaunchBreakendPanel
      feature={{
        uniqueId: 'random',
        refName,
        start,
        end: start + 1,
        mate: { refName, start: end, end: end + 1 },
      }}
      model={model}
      locStrings={[`${refName}:${end}`]}
    />
  ) : null
}

const FeatDefined = observer(function FeatDefined({
  feat,
  model,
}: {
  feat: VCFFeatureSerialized
  model: VariantFeatureWidgetModel
}) {
  const { descriptions } = model
  const {
    samples,
    genotypes,
    clickedSample,
    clickedGenotype,
    clickedAlleles,
    ...rest
  } = feat
  const { REF = '', INFO } = rest
  const svlenInfo = INFO?.SVLEN
  const svlen =
    Array.isArray(svlenInfo) && svlenInfo.every(v => typeof v === 'number')
      ? svlenInfo
      : undefined

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails
        feature={rest}
        model={model}
        descriptions={{
          ...variantFieldDescriptions,
          ...descriptions,
        }}
        formatter={(value, key, index) =>
          key === 'ALT' ? (
            <AltFormatter
              value={`${value}`}
              refString={REF}
              svlen={index === undefined ? undefined : svlen?.[index]}
            />
          ) : (
            <Formatter value={value} />
          )
        }
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
        <LaunchBreakendWidgetArea model={model} feat={feat} />
      </Suspense>
      {clickedSample ? (
        <BaseCard title={`Sample: ${clickedSample}`}>
          <Typography>Genotype: {`${clickedGenotype}`}</Typography>
          <Typography>Alleles: {`${clickedAlleles}`}</Typography>
        </BaseCard>
      ) : null}
      <VariantSampleGrid feature={feat} descriptions={descriptions} />
    </Paper>
  )
})

const VariantFeatureWidget = observer(function VariantFeatureWidget({
  model,
}: {
  model: VariantFeatureWidgetModel
}) {
  // eslint-disable-next-line @eslint-react/purity -- structuredClone is pure; clones MST proxy to plain object
  const feat = structuredClone(model.featureData)
  return feat ? (
    <FeatDefined feat={feat} model={model} />
  ) : (
    <div>
      No feature loaded, may not be available after page refresh because it was
      too large for localStorage
    </div>
  )
})

export default VariantFeatureWidget
