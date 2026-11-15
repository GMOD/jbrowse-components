import { observer } from 'mobx-react'

import FeatureDetails from './FeatureDetails.tsx'
import ParentFeatureLine from './ParentFeatureLine.tsx'
import {
  jexlFilterDisplay,
  rawValueFilterActions,
} from './jexlFilterActions.ts'

import type { ParentFeatureSummary } from '../../util/index.ts'
import type { SimpleFeatureSerialized } from '../../util/simpleFeature.ts'
import type {
  Descriptors,
  FeatureDetailsModel,
  FeatureFormatter,
} from '../types.tsx'
import type React from 'react'

export interface FeatureDetailsPanelModel extends FeatureDetailsModel {
  track?: { displays: readonly unknown[] }
  parentFeature?: ParentFeatureSummary
}

/**
 * One feature's details card with a widget's own panels around it. `feature`
 * is what the card shows; `unformatted`, the feature before any
 * `formatDetails` callback ran, is what the filter actions and the sequence
 * panel read, and what a widget's own panels should compute from.
 */
const FeatureDetailsPanel = observer(function FeatureDetailsPanel({
  model,
  feature,
  unformatted,
  descriptions,
  omit,
  formatter,
  isFilterable,
  before,
  after,
}: {
  model: FeatureDetailsPanelModel
  feature: SimpleFeatureSerialized
  unformatted: SimpleFeatureSerialized
  descriptions?: Descriptors
  omit?: string[]
  formatter?: FeatureFormatter
  /** which rows offer filter actions; every row when unset */
  isFilterable?: (path: string[]) => boolean
  before?: React.ReactNode
  after?: React.ReactNode
}) {
  const { parentFeature } = model
  // a track's filter tests its top-level features, so a panel opened on a
  // transcript inside a gene offers none
  const display = parentFeature ? undefined : jexlFilterDisplay(model.track)
  const filterActions = display
    ? rawValueFilterActions(display, unformatted)
    : undefined
  return (
    <>
      {parentFeature ? (
        <ParentFeatureLine parentFeature={parentFeature} />
      ) : null}
      {before}
      <FeatureDetails
        model={model}
        feature={feature}
        unformatted={unformatted}
        descriptions={descriptions}
        omit={omit}
        formatter={formatter}
        fieldActions={
          filterActions
            ? (path, value) =>
                !isFilterable || isFilterable(path)
                  ? filterActions(path, value)
                  : []
            : undefined
        }
      />
      {after}
    </>
  )
})

export default FeatureDetailsPanel
