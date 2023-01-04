import React from 'react'
import { Button, DialogContent, DialogActions } from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// locals
import { HierarchicalTrackSelectorModel } from '../model'
import FacetedSelector from './FacetedSelector'

function FacetedDlg(props: {
  handleClose: () => void
  model: HierarchicalTrackSelectorModel
}) {
  const { handleClose } = props
  return (
    <Dialog open onClose={handleClose} maxWidth="xl" title="Track selector">
      <DialogContent>
        <FacetedSelector {...props} />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => handleClose()}
          variant="contained"
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default observer(FacetedDlg)
