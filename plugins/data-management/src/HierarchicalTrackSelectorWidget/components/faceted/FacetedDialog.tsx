import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import FacetedSelector from './FacetedSelector'
import type { HierarchicalTrackSelectorModel } from '../../model'

const FacetedTrackSelectorDialog = observer(function (props: {
  handleClose: () => void
  model: HierarchicalTrackSelectorModel
}) {
  const { handleClose } = props
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="xl"
      title="Faceted track selector"
    >
      <DialogContent>
        <FacetedSelector {...props} />
      </DialogContent>
    </Dialog>
  )
})

export default FacetedTrackSelectorDialog
