import { Suspense } from 'react'

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
  const { omit = [], model, feature, depth = 0 } = props
  const maxDepth: number = model.maxDepth ?? 99999
  const { mate, name = '', id = '', type = '', subfeatures, uniqueId } = feature
  const pm = getEnv(model).pluginManager
  const m = mate as { start: number; end: number; refName: string } | undefined
  return (
    <BaseCard title={generateTitle(name, id, type)}>
      <Typography>Core details</Typography>
      <CoreDetails {...props} />
      {m ? (
        <>
          <Divider />
          <Typography>Mate details</Typography>
          <CoreDetails
            {...props}
            feature={{ ...m, uniqueId: `${uniqueId}-mate` }}
          />
        </>
      ) : null}

      <Divider />
      <Typography>Attributes</Typography>
      <Attributes
        attributes={feature}
        {...props}
        omit={omit}
        omitSingleLevel={coreDetails}
      />

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
