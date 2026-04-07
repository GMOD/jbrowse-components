import { useEffect } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import FacetedSelector from './FacetedSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'

const FacetedTrackSelectorDialog = observer(
  function FacetedTrackSelectorDialog(props: {
    handleClose: () => void
    model: HierarchicalTrackSelectorModel
  }) {
    const { handleClose } = props

    useEffect(() => {
      window.dispatchEvent(
        new CustomEvent('jbrowse:analytics', {
          detail: { type: 'faceted_selector_opened' },
        }),
      )
    }, [])

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
  },
)

export default FacetedTrackSelectorDialog
