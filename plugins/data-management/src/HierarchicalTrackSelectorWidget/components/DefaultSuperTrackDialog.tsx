import { readConfObject } from '@jbrowse/core/configuration'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../model.ts'
import type { TreeNode } from '../types.ts'

const DefaultSuperTrackDialog = observer(function DefaultSuperTrackDialog({
  model,
  superTrackId,
  subtracks,
  handleClose,
}: {
  model: HierarchicalTrackSelectorModel
  superTrackId: string
  subtracks: TreeNode[]
  handleClose: () => void
}) {
  const { shownTrackIds, view } = model

  return (
    <Dialog open onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{superTrackId}</DialogTitle>
      <DialogContent>
        <List dense>
          {subtracks
            .filter(s => s.type === 'track')
            .map(subtrack => {
              const { trackId, name, conf } = subtrack
              const checked = shownTrackIds.has(trackId)
              const description = readConfObject(conf, 'description')
              return (
                <ListItem key={trackId}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => {
                          view.toggleTrack(trackId)
                        }}
                      />
                    }
                    label={`${name}${description ? ` - ${description}` : ''}`}
                  />
                </ListItem>
              )
            })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default DefaultSuperTrackDialog
