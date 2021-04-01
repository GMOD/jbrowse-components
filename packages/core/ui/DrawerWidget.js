import Typography from '@material-ui/core/Typography'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Toolbar from '@material-ui/core/Toolbar'
import Select from '@material-ui/core/Select'
import MenuItem from '@material-ui/core/MenuItem'
import DeleteIcon from '@material-ui/icons/Delete'
import CloseIcon from '@material-ui/icons/Close'
import MinimizeIcon from '@material-ui/icons/Minimize'
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import { observer, PropTypes } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import React from 'react'
import Drawer from './Drawer'

const useStyles = makeStyles(theme => ({
  defaultDrawer: {},
  components: {
    display: 'block',
  },
  drawerActions: {
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
  spacer: {
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
  const { ReactComponent } = getEnv(session).pluginManager.getWidgetType(
    visibleWidget.type,
  )
  const classes = useStyles()

  const handleChange = (e, option) => {
    session.showWidget(option.props.value)
  }

  return (
    <Drawer session={session} open={Boolean(activeWidgets.size)}>
      <div className={classes.defaultDrawer}>
        <AppBar position="static" color="secondary">
          <Toolbar disableGutters className={classes.drawerToolbar}>
            <Select
              value={visibleWidget || ''}
              data-testid="widget-drawer-selects"
              className={classes.drawerSelect}
              classes={{ icon: classes.dropDownIcon }}
              renderValue={selected => {
                const {
                  HeadingComponent: HeadingComp,
                  heading: headingText,
                } = getEnv(session).pluginManager.getWidgetType(selected.type)
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
                  <MenuItem
                    data-testid={`widget-drawer-selects-item-${widget.type}`}
                    key={`${widget.id}-${index}`}
                    value={widget}
                  >
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
                        data-testid={`${widget.type}-drawer-delete`}
                        color="inherit"
                        aria-label="Delete"
                        onClick={() => {
                          session.hideWidget(widget)
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </MenuItem>
                )
              })}
            </Select>
            <div className={classes.spacer} />
            <div className={classes.drawerCloseButton}>
              <IconButton
                className={classes.drawerCloseButton}
                data-testid="drawer-minimize"
                color="inherit"
                onClick={() => {
                  session.minimizeWidgetDrawer()
                }}
              >
                <MinimizeIcon />
              </IconButton>
              <IconButton
                data-testid="drawer-close"
                color="inherit"
                onClick={() => {
                  session.hideWidget(visibleWidget)
                }}
              >
                <CloseIcon />
              </IconButton>
            </div>
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
