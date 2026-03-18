import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { facetedStateTreeF } from '../facetedModel.ts'
import FacetedSelector from './faceted/FacetedSelector.tsx'

import type { FacetedModel } from '../facetedModel.ts'
import type { HierarchicalTrackSelectorModel } from '../model.ts'
import type { TreeNode, TreeTrackNode } from '../types.ts'

function getTrackConfs(subtracks: TreeNode[]) {
  return subtracks
    .filter((s): s is TreeTrackNode => s.type === 'track')
    .map(s => s.conf)
}

function createFacetedModel(
  model: HierarchicalTrackSelectorModel,
  subtracks: TreeNode[],
) {
  const faceted = facetedStateTreeF().create({})
  faceted.setTrackConfigurations(getTrackConfs(subtracks), getSession(model))
  return faceted
}

const DefaultFolderDialog = observer(function DefaultFolderDialog({
  model,
  title,
  subtracks,
  handleClose,
}: {
  model: HierarchicalTrackSelectorModel
  title: string
  subtracks: TreeNode[]
  handleClose: () => void
}) {
  const [faceted] = useState<FacetedModel>(() =>
    createFacetedModel(model, subtracks),
  )

  return (
    <Dialog open onClose={handleClose} maxWidth="xl" title={title}>
      <DialogContent>
        <FacetedSelector model={model} faceted={faceted} />
      </DialogContent>
    </Dialog>
  )
})

export default DefaultFolderDialog
