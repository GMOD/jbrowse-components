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
import { getEnv } from 'mobx-state-tree'
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
    color: theme.palette.secondary.contrastText,
  },
  drawerLoading: {
    margin: theme.spacing(2),
  },
  dropDownIcon: {
    color: theme.palette.secondary.contrastText,
  },
}))

const DrawerWidget = observer(props => {
  const { session } = props
  const { visibleWidget, activeWidgets } = session
  const { ReactComponent, HeadingComponent, heading } = getEnv(
    session,
  ).pluginManager.getWidgetType(visibleWidget.type)
  const classes = useStyles()

  const handleChange = (e, option) => {
    session.showWidget(option.props.value)
  }

  // TODO: fix styling
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
              <>
                <Select
                  value={visibleWidget || ''}
                  inputProps={{ 'data-testid': 'widget-drawer-selects' }}
                  className={classes.drawerSelect}
                  classes={{ icon: classes.dropDownIcon }}
                  renderValue={selected => {
                    const {
                      HeadingComponent: HeadingComp,
                      heading: headingText,
                    } = getEnv(session).pluginManager.getWidgetType(
                      selected.type,
                    )
                    return (
                      <Typography variant="h6" color="inherit">
                        {HeadingComp ? (
                          <HeadingComp model={selected} />
                        ) : (
                          headingText || undefined
                        )}
                      </Typography>
                    )
                  }}
                  onChange={(e, value) => {
                    handleChange(e, value)
                  }}
                >
                  {Array.from(activeWidgets.values()).map((widget, index) => {
                    const {
                      HeadingComponent: HeadingComp,
                      heading: headingText,
                    } = getEnv(session).pluginManager.getWidgetType(widget.type)
                    return (
                      <MenuItem key={`${widget.id}-${index}`} value={widget}>
                        <Typography variant="h6" color="inherit">
                          {HeadingComp ? (
                            <HeadingComp model={widget} />
                          ) : (
                            headingText || undefined
                          )}
                        </Typography>
                        <ListItemSecondaryAction>
                          <IconButton
                            className={classes.drawerCloseButton}
                            data-testid="drawer-close"
                            color="inherit"
                            aria-label="Close"
                            onClick={() => {
                              session.hideWidget(widget)
                            }}
                          >
                            <CloseIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </MenuItem>
                    )
                  })}
                </Select>
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
