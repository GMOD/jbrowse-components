import AppBar from '@material-ui/core/AppBar'
import Button from '@material-ui/core/Button'
import CssBaseline from '@material-ui/core/CssBaseline'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import { ThemeProvider } from '@material-ui/styles'
import React from 'react'
import Theme from '../ui/theme'
import Track from './Track'
import View from './View'

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  grow: {
    flexGrow: 1,
  },
}))

export default function ButtonAppBar() {
  const classes = useStyles()

  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      <div className={classes.root}>
        <AppBar position="static">
          <Toolbar variant="dense">
            <Button color="inherit">
              File
              <ArrowDropDownIcon />
            </Button>
            <Button color="inherit">
              Help
              <ArrowDropDownIcon />
            </Button>
            <div className={classes.grow} />
            <Typography>Mockup</Typography>
            <div className={classes.grow} />
            <Typography variant="h6">JBrowse</Typography>
          </Toolbar>
        </AppBar>
        <View name="First View">
          <Track
            title="First Track Name"
            description="description of the first track"
          />
          <Track
            title="Second Track Name"
            description="description of the second track"
          />
        </View>
        <View name="Second View">
          <Track
            title="Another Track Name"
            description="description of the another track"
          />
        </View>
      </div>
    </ThemeProvider>
  )
}
