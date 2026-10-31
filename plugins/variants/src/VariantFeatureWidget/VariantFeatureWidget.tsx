import { Suspense, lazy, useMemo, useState } from 'react'

import {
  FeatureDetailsFrame,
  filterByValueItems,
  jexlFilterDisplay,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import Formatter from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Formatter'
import { ErrorBanner } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { assembleLocString, notEmpty } from '@jbrowse/core/util'
import { getBreakendMateLocString, safeParseBreakend } from '@jbrowse/sv-core'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getTraMate, symbolicAlleleBp } from '../VcfFeature/util.ts'
import AltFormatter from './AltFormatter.tsx'
import { tandemRepeatOf } from './TandemRepeatPanel/tandemRepeat.ts'
import { consequencePanels } from './VariantConsequence/parseConsequences.ts'
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
})

const FILTERABLE_COLUMNS = new Set(['QUAL', 'FILTER', 'ID', 'REF', 'ALT'])

function isFilterable(path: string[]) {
  return path.length === 1
    ? FILTERABLE_COLUMNS.has(path[0]!)
    : path.length === 2 && path[0] === 'INFO'
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
  const { REF = '', ALT = [], INFO } = rest
  const altBp = symbolicAlleleBp(ALT, INFO)
  const repeat = useMemo(() => {
    try {
      return tandemRepeatOf(feat)
    } catch (e) {
      console.error(e)
      return undefined
    }
  }, [feat])
  const [selectedAlt, setSelectedAlt] = useState<number | null>(null)
  const consequences = consequencePanels(INFO, descriptions)
  const display = jexlFilterDisplay(model.track)
  const fieldActions = display
    ? (path: string[], value: unknown) =>
        isFilterable(path) ? filterByValueItems(display, path, value) : []
    : undefined

  return (
    <Paper data-testid="variant-side-drawer">
      <Suspense fallback={null}>
        {repeat ? (
          <ErrorBoundary FallbackComponent={ErrorBanner}>
            <TandemRepeatPanel
              repeat={repeat}
              selectedAlt={selectedAlt}
              onSelectAlt={setSelectedAlt}
            />
          </ErrorBoundary>
        ) : null}
      </Suspense>
      <FeatureDetails
        feature={rest}
        unformatted={model.unformattedFeatureData}
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
              bp={index === undefined ? undefined : altBp[index]}
              mate={getTraMate(INFO)}
            />
          ) : (
            <Formatter value={value} />
          )
        }
        fieldActions={fieldActions}
        omit={consequences.map(({ key }) => key)}
      />
      <Suspense fallback={null}>
        {consequences.map(({ key, format, data, fields }) => (
          <VariantConsequencePanel
            key={key}
            fields={fields}
            data={data}
            format={format}
          />
        ))}
        <LaunchBreakendWidgetArea model={model} feat={feat} />
      </Suspense>
      {clickedSample ? (
        <BaseCard title={`Sample: ${clickedSample}`}>
          <Typography>Genotype: {`${clickedGenotype}`}</Typography>
          <Typography>Alleles: {`${clickedAlleles}`}</Typography>
        </BaseCard>
      ) : null}
      <VariantSampleGrid
        feature={feat}
        descriptions={descriptions}
        selectedAlt={selectedAlt}
      />
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
  return (
    <FeatureDetailsFrame model={model}>
      {featureData ? (
        <FeatDefined
          key={featureData.uniqueId}
          feat={featureData}
          model={model}
        />
      ) : null}
    </FeatureDetailsFrame>
  )
})

export default VariantFeatureWidget
