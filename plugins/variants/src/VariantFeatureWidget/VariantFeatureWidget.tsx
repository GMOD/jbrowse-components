import { Suspense, lazy, useState } from 'react'

import { parseBreakend } from '@gmod/vcf'
import {
  FeatureDetailsFrame,
  FeatureDetailsPanel,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import Formatter from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Formatter'
import { ErrorBanner } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { assembleLocString, notEmpty } from '@jbrowse/core/util'
import { getBreakendMateLocString } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getTraMate, symbolicAlleleBp } from '../VcfFeature/util.ts'
import { TANDEM_REPEAT } from '../shared/tandemRepeatRuns.ts'
import AltFormatter from './AltFormatter.tsx'
import { consequencePanels } from './VariantConsequence/parseConsequences.ts'
import VariantSampleGrid from './VariantSampleGrid/VariantSampleGrid.tsx'
import { isSvLaunchFeature } from './svLaunchType.ts'
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
const TandemRepeatPanel = lazy(
  () => import('./TandemRepeatPanel/TandemRepeatPanel.tsx'),
)
const VariantConsequencePanel = lazy(
  () => import('./VariantConsequence/VariantConsequencePanel.tsx'),
)

const LaunchBreakendWidgetArea = observer(function LaunchBreakendWidgetArea({
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
          ALT.map(alt => getBreakendMateLocString(parseBreakend(alt))).filter(
            notEmpty,
          ),
        ),
      ]
    : type.includes('translocation') && traMate !== undefined
      ? [traMate]
      : type.includes('paired_feature') && mate
        ? [assembleLocString(mate)]
        : []

  return locStrings.length ? (
    <LaunchBreakendPanel feature={feat} model={model} locStrings={locStrings} />
  ) : isSvLaunchFeature(feat) ? (
    <LaunchSvPanel feature={feat} model={model} />
  ) : null
})

const FILTERABLE_COLUMNS = new Set(['QUAL', 'FILTER', 'ID', 'REF', 'ALT'])

function isFilterable(path: string[]) {
  return path.length === 1
    ? FILTERABLE_COLUMNS.has(path[0]!)
    : path.length === 2 && path[0] === 'INFO'
}

const VariantDetails = observer(function VariantDetails({
  feat,
  raw,
  model,
}: {
  feat: VCFFeatureSerialized
  raw: VCFFeatureSerialized
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
  const { REF = '', ALT = [], INFO } = raw
  const altBp = symbolicAlleleBp(ALT, INFO)
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null)
  const consequences = consequencePanels(INFO, descriptions)
  return (
    <FeatureDetailsPanel
      model={model}
      feature={rest}
      unformatted={raw}
      testId="variant-side-drawer"
      descriptions={{ ...descriptions, ...variantFieldDescriptions }}
      omit={consequences.map(({ key }) => key)}
      isFilterable={isFilterable}
      formatter={(value, key, index) =>
        key === 'ALT' ? (
          <AltFormatter
            value={`${value}`}
            refString={REF}
            bp={index === undefined ? undefined : altBp[index]}
            mate={getTraMate(INFO)}
          />
        ) : (
          <Formatter value={value} />
        )
      }
      before={
        ALT.includes(TANDEM_REPEAT) ? (
          <ErrorBoundary FallbackComponent={ErrorBanner}>
            <Suspense fallback={null}>
              <TandemRepeatPanel
                feature={raw}
                selectedAlt={selectedAlt}
                onSelectAlt={setSelectedAlt}
              />
            </Suspense>
          </ErrorBoundary>
        ) : null
      }
      after={
        <>
          <Suspense fallback={null}>
            {consequences.map(({ key, format, data, fields }) => (
              <VariantConsequencePanel
                key={key}
                fields={fields}
                data={data}
                format={format}
              />
            ))}
            <LaunchBreakendWidgetArea model={model} feat={raw} />
          </Suspense>
          {clickedSample ? (
            <BaseCard title={`Sample: ${clickedSample}`}>
              <Typography>Genotype: {`${clickedGenotype}`}</Typography>
              <Typography>Alleles: {`${clickedAlleles}`}</Typography>
            </BaseCard>
          ) : null}
          <VariantSampleGrid
            feature={raw}
            descriptions={descriptions}
            selectedAlt={selectedAlt}
          />
        </>
      }
    />
  )
})

const VariantFeatureWidget = observer(function VariantFeatureWidget({
  model,
}: {
  model: VariantFeatureWidgetModel
}) {
  return (
    <FeatureDetailsFrame model={model}>
      {(feat, raw) => <VariantDetails feat={feat} raw={raw} model={model} />}
    </FeatureDetailsFrame>
  )
})

export default VariantFeatureWidget
