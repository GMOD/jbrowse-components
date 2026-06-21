import { Fragment, Suspense } from 'react'

import { Divider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import Attributes from './Attributes.tsx'
import BaseCard from './BaseCard.tsx'
import CoreDetails from './CoreDetails.tsx'
import { generateTitle } from './util.ts'
import { ErrorBoundary } from '../../ui/ErrorBoundary.tsx'
import { ErrorBanner, PluggableComponent } from '../../ui/index.ts'
import { getEnv } from '../../util/index.ts'
import SequenceFeatureDetails from '../SequenceFeatureDetails/index.tsx'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { Descriptors, FeatureFormatter } from '../types.tsx'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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
  model: IAnyStateTreeNode
  feature: SimpleFeatureSerialized
  depth?: number
  omit?: string[]
  descriptions?: Descriptors
  formatter?: FeatureFormatter
}

// default for the Core-extraFeaturePanel slot: renders nothing. A plugin
// replaces this via PluggableComponent and is responsible for its own
// Divider/BaseCard chrome.
function NoFeaturePanel(_props: FeatureDetailsProps) {
  return null
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
  const maxDepth: number = model.maxDepth ?? Infinity
  const {
    mate: m,
    name = '',
    id = '',
    type = '',
    subfeatures,
    uniqueId,
  } = feature
  const pm = getEnv(model).pluginManager
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

      <Suspense fallback={null}>
        <PluggableComponent
          pluginManager={pm}
          name="Core-extraFeaturePanel"
          component={NoFeaturePanel}
          props={props}
        />
      </Suspense>

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
            />
          ))}
        </BaseCard>
      ) : null}
    </BaseCard>
  )
})

export default FeatureDetails
