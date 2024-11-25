import React from 'react'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { Divider, Typography } from '@mui/material'

// locals
import { generateTitle } from './util'
import SequenceFeatureDetails from '../SequenceFeatureDetails'
import Attributes from './Attributes'
import BaseCard from './BaseCard'
import CoreDetails from './CoreDetails'
import { ErrorMessage } from '../../ui'
import { getEnv, getSession } from '../../util'
import type { SimpleFeatureSerialized } from '../../util'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

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

interface PanelDescriptor {
  name: string
  Component: React.FC<any>
}

export default function FeatureDetails(props: {
  model: IAnyStateTreeNode
  feature: SimpleFeatureSerialized
  depth?: number
  omit?: string[]
  descriptions?: Record<string, React.ReactNode>
  formatter?: (val: unknown, key: string) => React.ReactNode
}) {
  const { omit = [], model, feature, depth = 0 } = props
  const { maxDepth } = model
  const { mate, name = '', id = '', type = '', subfeatures, uniqueId } = feature
  const pm = getEnv(model).pluginManager
  const session = getSession(model)

  const ExtraPanel = pm.evaluateExtensionPoint('Core-extraFeaturePanel', null, {
    session,
    feature,
    model,
  }) as PanelDescriptor | undefined
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
            feature={{
              ...m,
              start: m.start,
              end: m.end,
              refName: m.refName,
              uniqueId: `${uniqueId}-mate`,
            }}
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

      <ErrorBoundary FallbackComponent={e => <ErrorMessage error={e.error} />}>
        <SequenceFeatureDetails {...props} />
      </ErrorBoundary>

      {ExtraPanel ? (
        <>
          <Divider />
          <BaseCard title={ExtraPanel.name}>
            <ExtraPanel.Component {...props} />
          </BaseCard>
        </>
      ) : null}

      {depth < maxDepth && subfeatures?.length ? (
        <BaseCard title="Subfeatures" defaultExpanded={depth < 1}>
          {subfeatures.map((sub, idx) => (
            <FeatureDetails
              key={JSON.stringify(sub)}
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
}
