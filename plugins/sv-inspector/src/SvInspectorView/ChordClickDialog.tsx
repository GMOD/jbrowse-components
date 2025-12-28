import { lazy } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { DialogContent, List, ListItemButton, ListItemText } from '@mui/material'
import { observer } from 'mobx-react'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const BreakendMultiLevelOptionDialog = lazy(
  () => import('./BreakendMultiLevelOptionDialog'),
)
const BreakendSingleLevelOptionDialog = lazy(
  () => import('./BreakendSingleLevelOptionDialog'),
)

const ChordClickDialog = observer(function ChordClickDialog({
  session,
  handleClose,
  feature,
  assemblyName,
  stableViewId,
  view,
}: {
  session: AbstractSessionModel
  handleClose: () => void
  feature: Feature
  view?: LinearGenomeViewModel
  assemblyName: string
  stableViewId?: string
}) {
  return (
    <Dialog open onClose={handleClose} title="Open breakpoint split view">
      <DialogContent>
        <List>
          <ListItemButton
            onClick={() => {
              handleClose()
              session.queueDialog(handleClose2 => [
                BreakendMultiLevelOptionDialog,
                {
                  handleClose: handleClose2,
                  session,
                  feature,
                  stableViewId: `${stableViewId}_multilevel`,
                  view,
                  assemblyName,
                },
              ])
            }}
          >
            <ListItemText
              primary="Split level (top/bottom)"
              secondary="Opens two stacked linear genome views, one for each breakend"
            />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              handleClose()
              session.queueDialog(handleClose2 => [
                BreakendSingleLevelOptionDialog,
                {
                  handleClose: handleClose2,
                  session,
                  feature,
                  stableViewId: `${stableViewId}_singlelevel`,
                  view,
                  assemblyName,
                },
              ])
            }}
          >
            <ListItemText
              primary="Single level (single row)"
              secondary="Opens one linear genome view spanning both breakends"
            />
          </ListItemButton>
        </List>
      </DialogContent>
    </Dialog>
  )
})

export default ChordClickDialog
