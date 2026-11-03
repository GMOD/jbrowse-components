import { Divider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { ErrorBoundary } from '../../ui/ErrorBoundary.tsx'
import PluggableComponents from '../../ui/PluggableComponents.tsx'
import { ErrorBanner } from '../../ui/index.ts'
import { getEnv } from '../../util/index.ts'
import SequenceFeatureDetails from '../SequenceFeatureDetails/index.tsx'
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
  const maxDepth = model.maxDepth ?? Infinity
  const { mate, name = '', id = '', type = '', subfeatures, uniqueId } = feature
  // a panel selecting on `depth === 0` has to see the default, not undefined
  const panelProps = { ...props, depth }
  const navigate = featureNavigator(model)
  const groups = subfeatureGroups(feature)
  return (
    <BaseCard
      title={generateTitle(name, id, type)}
      defaultExpanded={defaultExpanded}
    >
      <SectionHeader title="Core details" />
      <CoreDetails {...props} navigate={navigate} />
      {mate ? (
        <>
          <Divider />
          <SectionHeader title="Mate details" />
          <CoreDetails
            {...props}
            feature={{ ...mate, uniqueId: `${uniqueId}-mate` }}
            fieldActions={undefined}
            navigate={navigate}
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
        omitSingleLevel={[...shownByCoreDetails, 'mate']}
        descriptions={descriptions}
        formatter={formatter}
        fieldActions={fieldActions}
      />

      {depth === 0 ? (
        <ErrorBoundary FallbackComponent={e => <ErrorBanner error={e.error} />}>
          <SequenceFeatureDetails {...props} feature={unformatted} />
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
          {groups.map(group =>
            group.kind === 'feature' ? (
              <FeatureDetails
                key={group.feature.uniqueId}
                feature={group.feature}
                model={model}
                depth={depth + 1}
                defaultExpanded={groups.length === 1}
                descriptions={descriptions}
                formatter={formatter}
                omit={omit}
              />
            ) : (
              <SubfeatureParts
                key={group.type}
                group={group}
                navigate={navigate}
                descriptions={descriptions}
                formatter={formatter}
              />
            ),
          )}
        </>
      ) : null}
    </BaseCard>
  )
})

export default FeatureDetails
