import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  TextField,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  filter: {
    marginBottom: 8,
  },
  list: {
    maxHeight: 400,
    overflow: 'auto',
    border: '1px solid #e0e0e0',
    borderRadius: 4,
  },
  emptyMessage: {
    padding: 8,
    color: '#999',
  },
})

const LaunchPairwiseSyntenyDialog = observer(
  function LaunchPairwiseSyntenyDialog({
    model,
    handleClose,
    refAssembly,
    loc,
    trackId,
  }: {
    model: { displayedGenomes: string[] }
    handleClose: () => void
    refAssembly: string
    loc: string
    trackId: string
  }) {
    const { classes } = useStyles()
    const [filter, setFilter] = useState('')
    const filterLower = filter.toLowerCase()
    const filtered = model.displayedGenomes.filter(g =>
      g.toLowerCase().includes(filterLower),
    )

    return (
      <Dialog
        open
        onClose={() => {
          handleClose()
        }}
        title="Launch 2-way synteny view"
        maxWidth="sm"
        fullWidth
      >
        <DialogContent>
          <TextField
            value={filter}
            onChange={e => {
              setFilter(e.target.value)
            }}
            placeholder="Filter genomes..."
            size="small"
            fullWidth
            className={classes.filter}
            autoFocus
          />
          <List dense className={classes.list}>
            {filtered.map(genome => (
              <ListItemButton
                key={genome}
                onClick={() => {
                  getSession(model).addView('LinearSyntenyView', {
                    type: 'LinearSyntenyView',
                    init: {
                      views: [
                        { assembly: refAssembly, loc },
                        { assembly: genome },
                      ],
                      tracks: [[trackId]],
                    },
                  })
                  handleClose()
                }}
              >
                <ListItemText primary={genome} />
              </ListItemButton>
            ))}
            {filtered.length === 0 ? (
              <ListItemText
                primary="No genomes match filter"
                className={classes.emptyMessage}
              />
            ) : null}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default LaunchPairwiseSyntenyDialog
