import React from 'react'
import { observer } from 'mobx-react'
import { ObservableMap } from 'mobx'
import {
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'
// locals
import ModificationTable from './ModificationsTable'
import { ModificationTypeWithColor } from '../../shared/types'

const ColorByModificationsDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    setColorScheme: (arg: { type: string }) => void
    visibleModifications: ObservableMap<string, ModificationTypeWithColor>
    colorBy?: { type: string }
  }
  handleClose: () => void
}) {
  const { colorBy, visibleModifications } = model

  const modifications = [...visibleModifications.entries()]

  return (
    <Dialog open onClose={handleClose} title="Current modification colors">
      <DialogContent>
        <Typography>
          You can choose to color the modifications in the BAM/CRAM MM/ML
          specification using this dialog. Choosing modifications colors the
          modified positions and can color multiple modification types. Choosing
          the methylation setting colors methylated and unmethylated CpG.
        </Typography>
        <Typography>
          Note: you can revisit this dialog to see the current mapping of colors
          to modification type for the modification coloring mode
        </Typography>
        <div style={{ margin: 20 }}>
          {colorBy?.type === 'modifications' ? (
            <div>
              {modifications.length ? (
                <>
                  Current modification-type-to-color mapping
                  <ModificationTable
                    modifications={[...visibleModifications.entries()]}
                  />
                </>
              ) : (
                <>
                  <Typography>
                    Note: color by modifications is already enabled. Loading
                    current modifications...
                  </Typography>
                  <CircularProgress size={15} />
                </>
              )}
            </div>
          ) : null}
        </div>
        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              handleClose()
            }}
          >
            Close
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default ColorByModificationsDialog
