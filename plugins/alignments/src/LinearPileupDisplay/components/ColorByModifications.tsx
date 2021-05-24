import React from 'react'
import { observer } from 'mobx-react'
import { ObservableMap } from 'mobx'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  CircularProgress,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  root: {},
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },

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
  const classes = useStyles()
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
    setColorScheme: Function
    modificationTagMap: ObservableMap<string, string>
    colorBy?: { type: string }
  }
  handleClose: () => void
}) {
  const classes = useStyles()
  const { model, handleClose } = props
  const { colorBy, modificationTagMap } = model

  const modifications = [...modificationTagMap.entries()]

  return (
    <Dialog open onClose={handleClose}>
      <DialogTitle>
        Color by modifications
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className={classes.root}>
          <Typography>
            You can choose to color the modifications in the BAM/CRAM MM/ML
            specification using this dialog. Choosing modifications colors the
            modified positions and can color multiple modification types.
            Choosing the methylation setting colors methylated and unmethylated
            CpG.
          </Typography>
          <Typography>
            Note: you can revisit this dialog to see the current mapping of
            colors to modification type for the modification coloring mode
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
          <div style={{ display: 'flex' }}>
            <Button
              variant="contained"
              color="primary"
              style={{ margin: 5 }}
              onClick={() => {
                model.setColorScheme({
                  type: 'modifications',
                })
                handleClose()
              }}
            >
              Modifications
            </Button>
            <Button
              variant="contained"
              color="primary"
              style={{ margin: 5 }}
              onClick={() => {
                model.setColorScheme({
                  type: 'methylation',
                })
                handleClose()
              }}
            >
              Methylation
            </Button>
            <Button
              variant="contained"
              color="secondary"
              style={{ margin: 5 }}
              onClick={() => handleClose()}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default observer(ColorByTagDlg)
