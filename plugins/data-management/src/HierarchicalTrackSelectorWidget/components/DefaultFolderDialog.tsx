import { useEffect, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { destroy } from '@jbrowse/mobx-state-tree'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import FacetedSelector from '../../FacetedSelector/components/FacetedSelector.tsx'
import { facetedStateTreeF } from '../../FacetedSelector/facetedModel.ts'

import type { FacetedModel } from '../../FacetedSelector/facetedModel.ts'
import type { HierarchicalTrackSelectorModel } from '../model.ts'
import type { TreeTrackNode } from '../types.ts'

function createFacetedModel(
  model: HierarchicalTrackSelectorModel,
  subtracks: TreeTrackNode[],
) {
  const faceted = facetedStateTreeF().create({})
  faceted.setTrackConfigurations(
    subtracks.map(s => s.conf),
    getSession(model),
    model.assemblyNames,
  )
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
  subtracks: TreeTrackNode[]
  handleClose: () => void
}) {
  const [faceted] = useState<FacetedModel>(() =>
    createFacetedModel(model, subtracks),
  )
  useEffect(
    () => () => {
      destroy(faceted)
    },
    [faceted],
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
