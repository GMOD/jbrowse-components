import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
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

import type { MultiLGVSyntenyDisplayModel } from '../model.ts'

const LaunchPairwiseSyntenyDialog = observer(
  function LaunchPairwiseSyntenyDialog({
    model,
    handleClose,
    refAssembly,
    loc,
    trackId,
  }: {
    model: MultiLGVSyntenyDisplayModel
    handleClose: () => void
    refAssembly: string
    loc: string
    trackId: string
  }) {
    const [filter, setFilter] = useState('')
    const genomes = model.displayedGenomes
    const filtered = filter
      ? genomes.filter(g => g.toLowerCase().includes(filter.toLowerCase()))
      : genomes

    return (
      <Dialog
        open
        onClose={handleClose}
        title="Launch 2-way synteny view"
        maxWidth="sm"
        fullWidth
      >
        <DialogContent>
          <TextField
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter genomes..."
            size="small"
            fullWidth
            style={{ marginBottom: 8 }}
            autoFocus
          />
          <List
            dense
            style={{
              maxHeight: 400,
              overflow: 'auto',
              border: '1px solid #e0e0e0',
              borderRadius: 4,
            }}
          >
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
                style={{ padding: 8, color: '#999' }}
              />
            ) : null}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default LaunchPairwiseSyntenyDialog
