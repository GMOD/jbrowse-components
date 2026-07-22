import CoreFeatureSequenceDialog from '@jbrowse/core/BaseFeatureWidget/SequenceFeatureDetails/dialogs/FeatureSequenceDialog'
import { getSession, useFetch } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { findSubfeatureById } from '../baseModelHelpers.ts'

import type { SequenceHoverPosition } from '@jbrowse/core/BaseFeatureWidget'
import type { Feature } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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
  model: IAnyStateTreeNode & {
    setSequenceHoverPosition: (pos: SequenceHoverPosition | undefined) => void
    fetchFullFeature: (
      featureId: string,
      displayedRegionIndex: number,
    ) => Promise<Feature | undefined>
  }
  parentFeatureId: string
  featureId: string
  displayedRegionIndex: number
  assemblyName: string
  handleClose: () => void
}) {
  const { data: feature, error } = useFetch(
    ['canvasFeatureSequence', parentFeatureId, featureId, displayedRegionIndex],
    async () => {
      const parentFeature = await model.fetchFullFeature(
        parentFeatureId,
        displayedRegionIndex,
      )
      if (!parentFeature) {
        throw new Error('Could not fetch feature details')
      }
      const target =
        featureId === parentFeatureId
          ? parentFeature
          : findSubfeatureById(parentFeature, featureId)
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
