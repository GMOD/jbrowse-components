import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import FacetedSelector from './FacetedSelector.tsx'
import { facetedStateTreeF } from '../facetedModel.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

function createFacetedModel(model: HierarchicalTrackSelectorModel) {
  const faceted = facetedStateTreeF().create({})
  faceted.setTrackConfigurations(
    model.allTrackConfigurations,
    getSession(model),
  )
  return faceted
}

const FacetedTrackSelectorDialog = observer(
  function FacetedTrackSelectorDialog(props: {
    handleClose: () => void
    model: HierarchicalTrackSelectorModel
  }) {
    const { handleClose, model } = props
    const [faceted] = useState<FacetedModel>(() => createFacetedModel(model))
    return (
      <Dialog
        open
        onClose={handleClose}
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
