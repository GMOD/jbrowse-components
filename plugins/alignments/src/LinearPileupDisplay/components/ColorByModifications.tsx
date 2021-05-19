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
  root: {
    width: 300,
  },
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
      <DialogContent style={{ overflowX: 'hidden' }}>
        <div className={classes.root}>
          <Typography>
            This dialog presents current settings for the color by modifications
            setting
          </Typography>
          <div style={{ margin: 20 }}>
            {colorBy?.type === 'modifications' ? (
              <div>
                {modifications.length ? (
                  <>
                    Current modification-type-to-color mapping
                    <table className={classes.table}>
                      <tbody>
                        {modifications.map(([key, value]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>{value}</td>
                            <td
                              style={{
                                width: 14,
                                height: 14,
                                background: value,
                              }}
                            />
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
          </div>
          <Button
            variant="contained"
            color="primary"
            style={{ marginLeft: 20 }}
            onClick={() => {
              model.setColorScheme({
                type: 'modifications',
              })
              handleClose()
            }}
          >
            Color by modifications
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default observer(ColorByTagDlg)
