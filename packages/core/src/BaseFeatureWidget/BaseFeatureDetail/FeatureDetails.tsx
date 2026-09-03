import { Fragment } from 'react'

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
import { generateTitle } from './util.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type {
  Descriptors,
  FeatureDetailsModel,
  FeatureFormatter,
} from '../types.tsx'

function SectionHeader({ title }: { title: string }) {
  return <Typography variant="overline">{title}</Typography>
}

// interleave a <Divider/> between each node, e.g. [a,b,c] -> a | b | c
function joinByDivider(nodes: React.ReactNode[]) {
  return nodes.map((node, i) => (
    // eslint-disable-next-line @eslint-react/no-array-index-key -- fixed section order
    <Fragment key={i}>
      {i > 0 ? <Divider /> : null}
      {node}
    </Fragment>
  ))
}

// coreDetails are omitted in some circumstances
const coreDetails = [
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
  depth?: number
  omit?: string[]
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}

const FeatureDetails = observer(function FeatureDetails(
  props: FeatureDetailsProps,
) {
  const {
    omit = [],
    model,
    feature,
    depth = 0,
    descriptions,
    formatter,
  } = props
  const maxDepth = model.maxDepth ?? Infinity
  const {
    mate: m,
    name = '',
    id = '',
    type = '',
    subfeatures,
    uniqueId,
  } = feature
  // resolved rather than raw props: `depth` is what tells a registered panel
  // whether it is under the clicked feature (0) or a nested subfeature card, and
  // it is only defaulted here -- passing raw props left it undefined at the top
  // level, so a panel selecting on `depth === 0` could never match
  const panelProps = { ...props, depth }
  return (
    <BaseCard title={generateTitle(name, id, type)}>
      {joinByDivider(
        [
          <Fragment key="core">
            <SectionHeader title="Core details" />
            <CoreDetails {...props} />
          </Fragment>,
          m ? (
            <Fragment key="mate">
              <SectionHeader title="Mate details" />
              <CoreDetails
                {...props}
                feature={{ ...m, uniqueId: `${uniqueId}-mate` }}
              />
            </Fragment>
          ) : null,
          <Fragment key="attributes">
            <SectionHeader title="Attributes" />
            <Attributes
              attributes={feature}
              omit={omit}
              omitSingleLevel={coreDetails}
              descriptions={descriptions}
              formatter={formatter}
            />
          </Fragment>,
        ].filter(Boolean),
      )}

      <ErrorBoundary FallbackComponent={e => <ErrorBanner error={e.error} />}>
        <SequenceFeatureDetails {...props} />
      </ErrorBoundary>

      <PluggableComponents
        pluginManager={getEnv(model).pluginManager}
        /** #extensionPoint Core-extraFeaturePanel | sync | Add extra panels to the feature details widget */
        name="Core-extraFeaturePanel"
        props={panelProps}
      />

      {depth < maxDepth && subfeatures?.length ? (
        <BaseCard
          title="Subfeatures"
          defaultExpanded={depth === 0 && subfeatures.length <= 20}
        >
          {subfeatures.map((sub, idx) => (
            <FeatureDetails
              // eslint-disable-next-line @eslint-react/no-array-index-key -- subfeature list order is fixed per feature, no unique field guaranteed by type
              key={`${uniqueId}_${idx}`}
              feature={{
                ...sub,
                uniqueId: `${uniqueId}_${idx}`,
              }}
              model={model}
              depth={depth + 1}
              // a subfeature's fields are the same fields, so the caller's
              // descriptions and value formatter apply here too -- omitting
              // them silently dropped e.g. VCF header descriptions and the
              // truncating <Formatter> from every nested card
              descriptions={descriptions}
              formatter={formatter}
              omit={omit}
            />
          ))}
        </BaseCard>
      ) : null}
    </BaseCard>
  )
})

export default FeatureDetails
