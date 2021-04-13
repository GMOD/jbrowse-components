import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import AddIcon from '@material-ui/icons/Add'
import ArrowBackIosIcon from '@material-ui/icons/ArrowBackIos'
import { IconButton, Typography } from '@material-ui/core/'

const useStyles = makeStyles(theme => ({
  titleBox: {
    color: '#fff',
    backgroundColor: theme.palette.primary.main,
    textAlign: 'center',
  },
  dialogContent: {
    width: '100%',
  },
  backButton: {
    color: '#fff',
    position: 'absolute',
    left: theme.spacing(4),
    top: theme.spacing(4),
  },
}))

const PluginGUI = observer(
  ({
    rootModel,
    open,
    onClose,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rootModel: any
    open: boolean
    onClose: Function
  }) => {
    const classes = useStyles()

    // const pluginData = fetchPluginData()
    fetchPluginData()

    return (
      <Dialog open={open}>
        <DialogTitle className={classes.titleBox}>
          <Typography>Plugin manager</Typography>
        </DialogTitle>
        <DialogContent>
          <Typography>Im the plugin manager</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              onClose(false)
            }}
          >
            Return
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

const fetchPluginData = async () => {
  await fetch('https://s3.amazonaws.com/jbrowse.org/plugin-store/plugins.json')
    .then(response => response.json())
    .then(data => console.log(data))
}

export default PluginGUI
