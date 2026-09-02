import CoreFeatureSequenceDialog from '@jbrowse/core/BaseFeatureWidget/SequenceFeatureDetails/dialogs/FeatureSequenceDialog'
import { getSession } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { observer } from 'mobx-react'

import { getFeatureName } from '../../RenderFeatureDataRPC/labelUtils.ts'
import { findSubfeatureById } from '../baseModelHelpers.ts'

import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { Feature } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The core feature sequence panel, wired to a canvas display: the painting
// ships only slim render arrays, so the full feature (with its subfeatures, on
// which CDS/protein depend) is re-fetched by id before the panel can render it.
const FeatureSequenceDialog = observer(function FeatureSequenceDialog({
  model,
  parentFeatureId,
  featureId,
  displayedRegionIndex,
  assemblyName,
  handleClose,
}: {
  model: IStateTreeNode & {
    setSequenceHoverPosition: (pos: SequenceHoverPosition | undefined) => void
    fetchFullFeature: (
      featureId: string,
      displayedRegionIndex: number,
      opts?: { stopToken?: StopToken },
    ) => Promise<Feature | undefined>
  }
  parentFeatureId: string
  featureId: string
  displayedRegionIndex: number
  assemblyName: string
  handleClose: () => void
}) {
  const { data: feature, error } = useFetch(
    [
      'canvasFeatureSequence',
      parentFeatureId,
      featureId,
      displayedRegionIndex,
    ] as const,
    async (_name, _parentId, _featId, _regionIndex, stopToken) => {
      const parentFeature = await model.fetchFullFeature(
        parentFeatureId,
        displayedRegionIndex,
        { stopToken },
      )
      if (!parentFeature) {
        throw new Error('Could not fetch feature details')
      }
      const target =
        featureId === parentFeatureId
          ? parentFeature
          : findSubfeatureById(parentFeature, featureId)
      if (!target) {
        getSession(model).notify(
          `Could not find the clicked transcript "${featureId}"; showing the sequence of ${getFeatureName(parentFeature) ?? parentFeatureId} instead`,
          'warning',
        )
      }
      return (target ?? parentFeature).toJSON()
    },
  )

  return (
    <CoreFeatureSequenceDialog
      feature={feature}
      error={error}
      session={getSession(model)}
      assemblyName={assemblyName}
      hoverTarget={model}
      handleClose={handleClose}
    />
  )
})

export default FeatureSequenceDialog
