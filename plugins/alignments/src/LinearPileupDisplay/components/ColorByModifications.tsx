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
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  table: {
    border: '1px solid #888',
    margin: theme.spacing(4),
    '& td': {
      padding: theme.spacing(1),
    },
  },
}))

function ModificationTable({
  modifications,
}: {
  modifications: [string, string][]
}) {
  const { classes } = useStyles()
  return (
    <table className={classes.table}>
      <tbody>
        {modifications.map(([key, value]) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{value}</td>
            <td
              style={{
                width: '1em',
                background: value,
              }}
            />
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ColorByTagDlg(props: {
  model: {
    setColorScheme: (arg: { type: string }) => void
    modificationTagMap: ObservableMap<string, string>
    colorBy?: { type: string }
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const { colorBy, modificationTagMap } = model

  const modifications = [...modificationTagMap.entries()]

  return (
    <Dialog open onClose={handleClose} title="Color by modifications">
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
                    modifications={[...modificationTagMap.entries()]}
                  />
                </>
              ) : (
                <div>
                  <Typography>
                    Note: color by modifications is already enabled. Loading
                    current modifications...
                  </Typography>
                  <CircularProgress size={15} />
                </div>
              )}
            </div>
          ) : null}
          {colorBy?.type === 'methylation' ? (
            <ModificationTable
              modifications={[
                ['methylated', 'red'],
                ['unmethylated', 'blue'],
              ]}
            />
          ) : null}
        </div>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              model.setColorScheme({ type: 'modifications' })
              handleClose()
            }}
          >
            Modifications
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              model.setColorScheme({ type: 'methylation' })
              handleClose()
            }}
          >
            Methylation
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
}

export default observer(ColorByTagDlg)
