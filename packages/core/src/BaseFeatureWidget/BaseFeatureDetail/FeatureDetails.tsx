import { Divider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { ErrorBoundary } from '../../ui/ErrorBoundary.tsx'
import PluggableComponents from '../../ui/PluggableComponents.tsx'
import { ErrorBanner } from '../../ui/index.ts'
import { getEnv } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import TranscriptSelector from '../SequenceFeatureDetails/dialogs/TranscriptSelector.tsx'
import SequenceFeatureDetails from '../SequenceFeatureDetails/index.tsx'
import { useTranscriptPick } from '../SequenceFeatureDetails/useTranscriptPick.ts'
import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'
import CoreDetails from './CoreDetails.tsx'
import SubfeatureParts from './SubfeatureParts.tsx'
import { featureNavigator } from './featureNavigator.ts'
import { subfeatureGroups } from './subfeatureGroups.ts'
import { generateTitle } from './util.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type {
  Descriptors,
  FeatureDetailsModel,
  FeatureFormatter,
  FieldActions,
} from '../types.tsx'

const useStyles = makeStyles()(theme => ({
  picker: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
}))

const SectionHeader = observer(function SectionHeader({
  title,
}: {
  title: string
}) {
  return <Typography variant="overline">{title}</Typography>
})

const shownByCoreDetails = [
  'name',
  'start',
  'end',
  'strand',
  'refName',
  'description',
  'type',
]

interface FeatureDetailsProps {
  model: FeatureDetailsModel
  feature: SimpleFeatureSerialized
  unformatted?: SimpleFeatureSerialized
  depth?: number
  defaultExpanded?: boolean
  omit?: string[]
  descriptions?: Descriptors
  formatter?: FeatureFormatter
  fieldActions?: FieldActions
}

const FeatureDetails = observer(function FeatureDetails(
  props: FeatureDetailsProps,
) {
  const {
    omit = [],
    model,
    feature,
    unformatted = feature,
    depth = 0,
    defaultExpanded = true,
    descriptions,
    formatter,
    fieldActions,
  } = props
  const { classes } = useStyles()
  const maxDepth = model.maxDepth ?? Infinity
  const { mate, name, subfeatures, uniqueId } = feature
  // a panel selecting on `depth === 0` has to see the default, not undefined
  const panelProps = { ...props, depth }
  const locate = featureNavigator(model)
  const { cards, groups } = subfeatureGroups(feature, unformatted)
  const pick = useTranscriptPick(unformatted, model.canonicalTranscripts)
  // the clicked feature shows one of its transcripts, picked from a menu
  // shared with the sequence panel; a deeper card shows all of its own
  const picking = depth === 0 && cards.length > 1
  const shownCards = picking
    ? cards.filter((_, idx) => idx === pick.index)
    : cards
  const openCards = depth === 0 || cards.length + groups.length === 1
  return (
    <BaseCard title={generateTitle(feature)} defaultExpanded={defaultExpanded}>
      <SectionHeader title="Core details" />
      <CoreDetails {...props} locate={locate} />
      {mate ? (
        <>
          <Divider />
          <SectionHeader title="Mate details" />
          <CoreDetails
            {...props}
            feature={{ ...mate, uniqueId: `${uniqueId}-mate` }}
            fieldActions={undefined}
            locate={locate}
          />
          <Attributes
            attributes={mate}
            prefix={['mate']}
            omit={omit}
            omitSingleLevel={shownByCoreDetails}
            descriptions={descriptions}
            formatter={formatter}
            fieldActions={fieldActions}
          />
        </>
      ) : null}
      <Divider />
      <SectionHeader title="Attributes" />
      <Attributes
        attributes={feature}
        omit={omit}
        omitSingleLevel={[
          ...shownByCoreDetails,
          'mate',
          ...(feature.id === name ? ['id'] : []),
        ]}
        descriptions={descriptions}
        formatter={formatter}
        fieldActions={fieldActions}
      />

      {depth === 0 ? (
        <ErrorBoundary FallbackComponent={e => <ErrorBanner error={e.error} />}>
          <SequenceFeatureDetails
            {...props}
            feature={unformatted}
            transcriptPick={pick}
          />
        </ErrorBoundary>
      ) : null}

      <PluggableComponents
        pluginManager={getEnv(model).pluginManager}
        /** #extensionPoint Core-extraFeaturePanel | sync | Add extra panels to the feature details widget */
        name="Core-extraFeaturePanel"
        props={panelProps}
      />

      {depth < maxDepth && subfeatures?.length ? (
        <>
          <Divider />
          <SectionHeader title="Subfeatures" />
          {picking ? (
            <div className={classes.picker}>
              <TranscriptSelector pick={pick} fullWidth />
            </div>
          ) : null}
          {shownCards.map(card => (
            <FeatureDetails
              key={card.feature.uniqueId}
              feature={card.feature}
              unformatted={card.unformatted}
              model={model}
              depth={depth + 1}
              defaultExpanded={openCards}
              descriptions={descriptions}
              formatter={formatter}
              omit={omit}
            />
          ))}
          {groups.map(group => (
            <SubfeatureParts
              key={group.type}
              group={group}
              locate={locate}
              descriptions={descriptions}
              formatter={formatter}
            />
          ))}
        </>
      ) : null}
    </BaseCard>
  )
})

export default FeatureDetails
