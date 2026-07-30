import { Dialog } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { useFacetedModel } from '../useFacetedModel.ts'
import FacetedSelector from './FacetedSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'

const FacetedTrackSelectorDialog = observer(
  function FacetedTrackSelectorDialog({
    handleClose,
    model,
  }: {
    handleClose: () => void
    model: HierarchicalTrackSelectorModel
  }) {
    const faceted = useFacetedModel(model, () => model.allTrackConfigurations)
    return (
      <Dialog
        open
        onClose={() => {
          handleClose()
        }}
        maxWidth="xl"
        title="Faceted track selector"
      >
        <DialogContent>
          <FacetedSelector model={model} faceted={faceted} />
        </DialogContent>
      </Dialog>
    )
  },
)

export default FacetedTrackSelectorDialog
