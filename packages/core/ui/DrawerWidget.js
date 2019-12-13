import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import CircularProgress from '@material-ui/core/CircularProgress'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Toolbar from '@material-ui/core/Toolbar'
import { makeStyles } from '@material-ui/core/styles'
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
  const { visibleDrawerWidget, pluginManager } = session
  const {
    LazyReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getDrawerWidgetType(visibleDrawerWidget.type)
  const classes = useStyles()

  return (
    <Drawer session={session} open={Boolean(session.activeDrawerWidgets.size)}>
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar
            variant="dense"
            disableGutters
            className={classes.drawerToolbar}
          >
            <Typography variant="h6" color="inherit">
              {HeadingComponent ? (
                <HeadingComponent model={visibleDrawerWidget} />
              ) : (
                heading || undefined
              )}
            </Typography>
            <div className={classes.drawerToolbarCloseButton} />
            <IconButton
              className={classes.drawerCloseButton}
              color="inherit"
              aria-label="Close"
              onClick={() => session.hideDrawerWidget(visibleDrawerWidget)}
            >
              <Icon fontSize="small">close</Icon>
            </IconButton>
          </Toolbar>
        </AppBar>
        <React.Suspense
          fallback={
            <CircularProgress disableShrink className={classes.drawerLoading} />
          }
        >
          <LazyReactComponent model={visibleDrawerWidget} session={session} />
        </React.Suspense>
      </div>
    </Drawer>
  )
})

DrawerWidget.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default DrawerWidget
