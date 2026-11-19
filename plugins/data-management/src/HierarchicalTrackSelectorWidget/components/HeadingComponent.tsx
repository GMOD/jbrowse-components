import { getSession } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const HeadingComponent = observer(function HeadingComponent({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { assemblyManager } = getSession(model)
  const viewName =
    model.view?.displayName ||
    model.assemblyNames
      .map(name => assemblyManager.getDisplayName(name))
      .join(', ')
  const heading = viewName
    ? `${viewName} — Available tracks`
    : 'Available tracks'

  return (
    <Typography variant="h6" color="inherit" title={heading}>
      {heading}
    </Typography>
  )
})

export default HeadingComponent
