import { Suspense, lazy } from 'react'

import { FeatureWash } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import Formatter from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Formatter'
import { assembleLocString, notEmpty } from '@jbrowse/core/util'
import { getBreakendMateLocString, safeParseBreakend } from '@jbrowse/sv-core'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getTraMate, parseFiniteNumber } from '../VcfFeature/util.ts'
import AltFormatter from './AltFormatter.tsx'
import VariantSampleGrid from './VariantSampleGrid/VariantSampleGrid.tsx'
import { isSvLaunchType } from './svLaunchType.ts'
import { variantFieldDescriptions } from './variantFieldDescriptions.ts'

import type { VariantFeatureWidgetModel } from './stateModelFactory.ts'
import type { Descriptions, VCFFeatureSerialized } from './types.ts'

// lazies
const LaunchBreakendPanel = lazy(
  () => import('./LaunchBreakendPanel/LaunchBreakendPanel.tsx'),
)
const LaunchSvPanel = lazy(
  () => import('./LaunchBreakendPanel/LaunchSvPanel.tsx'),
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
  // SnpEff/VEP write the field list with padding (e.g. "annotations: 'Allele |
  // Annotation | ...'") while the per-variant data uses bare pipes, so trim
  // each header field to line the DataGrid columns up with the values.
  const fields =
    desc
      ?.match(regex)?.[1]
      ?.split('|')
      .map(f => f.trim()) ?? []
  const data = feature.INFO?.[fieldKey]
  // gate here rather than inside the grid: most variants carry neither field,
  // and mounting the lazy grid just to have it render null still fetches its
  // chunk on every feature click
  return data?.length ? (
    <VariantConsequenceDataGrid fields={fields} data={data} title={title} />
  ) : null
}

function LaunchBreakendWidgetArea({
  model,
  feat,
}: {
  model: VariantFeatureWidgetModel
  feat: VCFFeatureSerialized
}) {
  const { type = '', ALT = [], INFO, mate } = feat
  const traMate = getTraMate(INFO)
  // a multiallelic record carries the comma-joined SO terms of all its ALTs
  // (e.g. 'breakend,deletion'), so match the type as a substring. ALTs with no
  // navigable mate are dropped: they have no endpoint to open, and listing them
  // produced rows whose link navigated to '' or to a '<DEL>:1' placeholder.
  const locStrings = type.includes('breakend')
    ? [
        ...new Set(
          ALT.map(alt =>
            getBreakendMateLocString(safeParseBreakend(alt)),
          ).filter(notEmpty),
        ),
      ]
    : type.includes('translocation') && traMate !== undefined
      ? [traMate]
      : type.includes('paired_feature') && mate
        ? [assembleLocString(mate)]
        : []

  return locStrings.length ? (
    <LaunchBreakendPanel feature={feat} model={model} locStrings={locStrings} />
  ) : isSvLaunchType(type) ? (
    <LaunchSvPanel feature={feat} model={model} />
  ) : null
}

const FeatDefined = observer(function FeatDefined({
  feat,
  model,
}: {
  feat: VCFFeatureSerialized
  model: VariantFeatureWidgetModel
}) {
  // annotated to shed the MST node brand types.frozen() carries on the
  // instance, which a spread would otherwise copy into the descriptions object
  const descriptions: Descriptions | undefined = model.descriptions
  const {
    samples,
    genotypes,
    clickedSample,
    clickedGenotype,
    clickedAlleles,
    ...rest
  } = feat
  const { REF = '', INFO } = rest
  // SVLEN arrives as strings when the header doesn't declare it Integer, and
  // can carry '.' for a missing entry, so coerce per ALT index rather than
  // requiring the whole array to be numeric (which dropped the span entirely)
  const svlens = Array.isArray(INFO?.SVLEN) ? INFO.SVLEN : []

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
              svlen={
                index === undefined
                  ? undefined
                  : parseFiniteNumber(svlens[index])
              }
              mate={getTraMate(INFO)}
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
          regex={/Format:\s*(.*)/}
        />
        <AnnotationPanel
          feature={rest}
          descriptions={descriptions}
          fieldKey="ANN"
          title="Variant ANN field"
          regex={/Functional annotations:\s*'(.*)'/}
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
  const { featureData } = model
  // keyed by feature: the widget instance is reused for the next variant clicked
  // (one widget id per track, and the drawer renders it without a key), so
  // without this the sample grid's filters and genotype selection carry over and
  // silently empty the next variant's grid
  return featureData ? (
    // the wash sits outside that key on purpose: inside it, it would remount
    // on every swap and never play
    <FeatureWash uniqueId={featureData.uniqueId}>
      <FeatDefined
        key={featureData.uniqueId}
        feat={featureData}
        model={model}
      />
    </FeatureWash>
  ) : (
    <div>
      No feature loaded, may not be available after page refresh because it was
      too large for localStorage
    </div>
  )
})

export default VariantFeatureWidget
