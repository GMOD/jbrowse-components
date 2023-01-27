import React from 'react'
import { DialogContent } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// locals
import { HierarchicalTrackSelectorModel } from '../../model'
import FacetedSelector from './FacetedSelector'

function FacetedDlg(props: {
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
}

export default observer(FacetedDlg)
