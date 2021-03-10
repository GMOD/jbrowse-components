import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Toolbar from '@material-ui/core/Toolbar'
import Select from '@material-ui/core/Select'
import MenuItem from '@material-ui/core/MenuItem'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
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
  drawerSelect: {
    width: '100%',
    color: 'white',
  },
  drawerLoading: {
    margin: theme.spacing(2),
  },
}))

const DrawerWidget = observer(props => {
  const { session } = props
  const { visibleWidget, pluginManager, activeWidgets } = session
  const {
    ReactComponent,
    HeadingComponent,
    heading,
  } = pluginManager.getWidgetType(visibleWidget.type)
  const classes = useStyles()

  const handleChange = (e, option) => {
    session.showWidget(option.props.value)
  }

  // TODO: fix styling
  // TODO: add title and description to the selection dropdown, tittle >>
  // TODO: have a way to manage widgets from dropdown
  return (
    <Drawer session={session} open={Boolean(activeWidgets.size)}>
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar disableGutters className={classes.drawerToolbar}>
            {activeWidgets.size <= 1 ? (
              <>
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
                    session.hideWidget(visibleWidget)
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </>
            ) : (
              <Select
                value={visibleWidget || ''}
                className={classes.drawerSelect}
                displayEmpty
                onChange={(e, value) => {
                  handleChange(e, value)
                }}
              >
                {Array.from(activeWidgets.values()).map((widget, index) => {
                  return (
                    <MenuItem key={`${widget.id}-${index}`} value={widget}>
                      {widget.id}
                      <ListItemSecondaryAction>
                        <IconButton
                          className={classes.drawerCloseButton}
                          data-testid="drawer-close"
                          color="inherit"
                          aria-label="Close"
                          onClick={() => {
                            session.hideWidget(visibleWidget)
                          }}
                        >
                          <CloseIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </MenuItem>
                  )
                })}
              </Select>
            )}
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
