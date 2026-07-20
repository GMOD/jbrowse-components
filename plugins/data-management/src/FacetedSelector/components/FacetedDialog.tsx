import { useEffect, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { destroy } from '@jbrowse/mobx-state-tree'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { facetedStateTreeF } from '../facetedModel.ts'
import FacetedSelector from './FacetedSelector.tsx'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

function createFacetedModel(model: HierarchicalTrackSelectorModel) {
  const faceted = facetedStateTreeF().create({})
  faceted.setTrackConfigurations(
    model.allTrackConfigurations,
    getSession(model),
    model.assemblyNames,
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
    useEffect(
      () => () => {
        destroy(faceted)
      },
      [faceted],
    )
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
