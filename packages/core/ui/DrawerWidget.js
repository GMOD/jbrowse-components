import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Toolbar from '@material-ui/core/Toolbar'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import CloseIcon from '@material-ui/icons/Close'
import { observer, PropTypes } from 'mobx-react'
import React from 'react'
import Drawer from './Drawer'

const useStyles = makeStyles(theme => ({
  defaultDrawer: {},
  components: {
    display: 'block',
  },
  drawerCloseButton: {
    float: 'right',
    '&:hover': {
      backgroundColor: fade(
        theme.palette.secondary.contrastText,
        theme.palette.action.hoverOpacity,
      ),
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
  },
  drawerToolbar: {
    paddingLeft: theme.spacing(2),
  },
  drawerToolbarCloseButton: {
    flexGrow: 1,
  },
  drawerLoading: {
    margin: theme.spacing(2),
  },
}))
const DrawerWidget = observer(props => {
  const { session } = props
  const { visibleWidget, pluginManager } = session
  const {
    ReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getWidgetType(visibleWidget.type)
  const classes = useStyles()

  return (
    <Drawer session={session} open={Boolean(session.activeWidgets.size)}>
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar
            variant="dense"
            disableGutters
            className={classes.drawerToolbar}
          >
            <Typography variant="h6" color="inherit">
              {HeadingComponent ? (
                <HeadingComponent model={visibleWidget} />
              ) : (
                heading || undefined
              )}
            </Typography>
            <div className={classes.drawerToolbarCloseButton} />
            <IconButton
              className={classes.drawerCloseButton}
              data-testid="drawer-close"
              color="inherit"
              aria-label="Close"
              onClick={() => session.hideWidget(visibleWidget)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>
        <ReactComponent model={visibleWidget} session={session} />
      </div>
    </Drawer>
  )
})

DrawerWidget.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default DrawerWidget
