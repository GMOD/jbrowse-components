import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Toolbar from '@material-ui/core/Toolbar'
import Tab from '@material-ui/core/Tab'
import Tabs from '@material-ui/core/Tabs'
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
  const [value, setValue] = React.useState(visibleWidget)

  const handleChange = (event, newVal) => {
    console.log(newVal)
    console.log(value)
    setValue(newVal)
    session.showWidget(newVal)
  }

  const activeWidgets = Array.from(session.activeWidgets.values())
  const tabs = activeWidgets.map((widget, index) => {
    return <Tab key={widget.id} label={widget.id} value={widget} />
  })
  console.log(activeWidgets)
  return (
    <Drawer session={session} open={Boolean(session.activeWidgets.size)}>
      {session.activeWidgets.size > 1 && (
        <Tabs
          indicatorColor="primary"
          textColor="primary"
          onChange={handleChange}
          aria-label="disabled tabs example"
        >
          {activeWidgets.map(widget => {
            return <Tab key={widget} label={widget.id} value={widget} />
          })}
        </Tabs>
      )}
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar disableGutters className={classes.drawerToolbar}>
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
              onClick={() => {
                console.log('I hid it')
                console.log(visibleWidget)
                session.hideWidget(visibleWidget)
              }}
            >
              <CloseIcon />
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
