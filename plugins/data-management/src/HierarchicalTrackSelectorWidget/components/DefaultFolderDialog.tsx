import { Dialog } from '@jbrowse/core/ui'
import { notEmpty } from '@jbrowse/core/util'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import FacetedSelector from '../../FacetedSelector/components/FacetedSelector.tsx'
import { useFacetedModel } from '../../FacetedSelector/useFacetedModel.ts'

import type { HierarchicalTrackSelectorModel } from '../model.ts'
import type { TreeTrackNode } from '../types.ts'

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
  // the folder's membership is fixed when the dialog opens, but the configs are
  // re-resolved from the live model so a track deleted from inside the dialog
  // drops out instead of leaving a row on a destroyed config
  const faceted = useFacetedModel(model, () =>
    subtracks
      .map(s => model.allTrackConfigurationMap.get(s.trackId))
      .filter(notEmpty),
  )
  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      maxWidth="xl"
      title={title}
    >
      <DialogContent>
        <FacetedSelector model={model} faceted={faceted} />
      </DialogContent>
    </Dialog>
  )
})

export default DefaultFolderDialog
