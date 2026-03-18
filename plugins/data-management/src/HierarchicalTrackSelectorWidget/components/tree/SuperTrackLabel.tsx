import { lazy, memo, useCallback } from 'react'

import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { getEnv, getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { TreeSuperTrackNode } from '../../types.ts'

const DefaultSuperTrackDialog = lazy(
  () => import('../DefaultSuperTrackDialog.tsx'),
)

const useStyles = makeStyles()({
  superTrackText: {
    margin: 'auto 0',
    width: '100%',
  },
})

const SuperTrackLabel = memo(function SuperTrackLabel({
  model,
  item,
}: {
  model: HierarchicalTrackSelectorModel
  item: TreeSuperTrackNode
}) {
  const { classes } = useStyles()
  const { name, superTrackId } = item

  const openDialog = useCallback(() => {
    const session = getSession(model)
    const { pluginManager } = getEnv(model)
    const DialogComponent = pluginManager.evaluateExtensionPoint(
      'TrackSelector-superTrackDialog',
      DefaultSuperTrackDialog,
      { superTrackId, model, subtracks: item.children },
    ) as React.FC<{
      model: HierarchicalTrackSelectorModel
      superTrackId: string
      subtracks: TreeSuperTrackNode['children']
      handleClose: () => void
    }>

    session.queueDialog((handleClose: () => void) => [
      DialogComponent,
      {
        model,
        superTrackId,
        subtracks: item.children,
        handleClose,
      },
    ])
  }, [model, superTrackId, item.children])

  return (
    <div className={classes.superTrackText} onClick={openDialog}>
      <Typography data-testid={`htsSuperTrack-${name}`}>
        <SanitizedHTML html={name} />
      </Typography>
    </div>
  )
})

export default SuperTrackLabel
