import React, { useState, Suspense } from 'react'
import {
  AppBar,
  Button,
  Fab,
  MenuItem,
  Paper,
  Select,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import LaunchIcon from '@mui/icons-material/Launch'
import { observer } from 'mobx-react'
import { getEnv, getSnapshot } from 'mobx-state-tree'

// locals
import { readConfObject, AnyConfigurationModel } from '../configuration'
import DrawerWidget from './DrawerWidget'
import DropDownMenu from './DropDownMenu'
import EditableTypography from './EditableTypography'
import { LogoFull } from './Logo'
import Snackbar from './Snackbar'
import ViewContainer from './ViewContainer'
import {
  NotificationLevel,
  SessionWithDrawerWidgets,
  SnackAction,
} from '../util'
import { MenuItem as JBMenuItem } from './index'

const useStyles = makeStyles()(theme => ({
  root: {
    fontFamily: 'Roboto',
    display: 'grid',
    height: '100vh',
    width: '100%',
  },
  fabLeft: {
    zIndex: 10000,
    position: 'fixed',
    bottom: theme.spacing(2),
    left: theme.spacing(2),
  },
  fabRight: {
    zIndex: 10000,
    position: 'fixed',
    bottom: theme.spacing(2),
    right: theme.spacing(2),
  },
  menuBarAndComponents: {
    gridColumn: 'main',
    display: 'grid',
    gridTemplateRows: '[menubar] min-content [components] auto',
    height: '100vh',
  },
  menuBar: {
    gridRow: 'menubar',
  },
  components: {
    overflowY: 'auto',
    gridRow: 'components',
  },
  appBar: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
  inputBase: {
    color: theme.palette.primary.contrastText,
  },
  inputRoot: {
    '&:hover': {
      backgroundColor: theme.palette.primary.light,
    },
  },
  inputFocused: {
    borderColor: theme.palette.secondary.main,
    backgroundColor: theme.palette.primary.light,
  },

  selectPaper: {
    padding: theme.spacing(4),
  },
}))

const Logo = observer(
  ({ session }: { session: { configuration: AnyConfigurationModel } }) => {
    const { configuration } = session
    const logoPath = readConfObject(configuration, 'logoPath')
    if (!logoPath?.uri) {
      return <LogoFull variant="white" />
    } else {
      return <img src={logoPath.uri} alt="Custom logo" />
    }
  },
)

type SnackbarMessage = [string, NotificationLevel, SnackAction]

const App = observer(
  ({
    session,
    HeaderButtons = <div />,
  }: {
    HeaderButtons?: React.ReactElement
    session: SessionWithDrawerWidgets & {
      savedSessionNames: string[]
      menus: { label: string; menuItems: JBMenuItem[] }[]
      renameCurrentSession: (arg: string) => void
      snackbarMessages: SnackbarMessage[]
      popSnackbarMessage: () => unknown
    }
  }) => {
    const { classes } = useStyles()
    const { pluginManager } = getEnv(session)
    const viewTypes = pluginManager.getElementTypeRecord('view').all()
    const [value, setValue] = useState(viewTypes[0]?.name)
    const {
      visibleWidget,
      drawerWidth,
      minimized,
      activeWidgets,
      savedSessionNames,
      name,
      menus,
      views,
      drawerPosition,
    } = session

    function handleNameChange(newName: string) {
      if (savedSessionNames?.includes(newName)) {
        session.notify(
          `Cannot rename session to "${newName}", a saved session with that name already exists`,
          'warning',
        )
      } else {
        session.renameCurrentSession(newName)
      }
    }

    const drawerVisible = visibleWidget && !minimized

    let grid
    if (drawerPosition === 'right') {
      grid = [
        `[main] 1fr`,
        drawerVisible ? `[drawer] ${drawerWidth}px` : undefined,
      ]
    } else if (drawerPosition === 'left') {
      grid = [
        drawerVisible ? `[drawer] ${drawerWidth}px` : undefined,
        `[main] 1fr`,
      ]
    }
    return (
      <div
        className={classes.root}
        style={{
          gridTemplateColumns: grid?.filter(f => !!f).join(' '),
        }}
      >
        {drawerVisible && drawerPosition === 'left' ? (
          <DrawerWidget session={session} />
        ) : null}

        {session.DialogComponent ? (
          <Suspense fallback={<div />}>
            <session.DialogComponent {...session.DialogProps} />
          </Suspense>
        ) : null}
        <div className={classes.menuBarAndComponents}>
          <div className={classes.menuBar}>
            <AppBar className={classes.appBar} position="static">
              <Toolbar>
                {menus.map(menu => (
                  <DropDownMenu
                    key={menu.label}
                    menuTitle={menu.label}
                    menuItems={menu.menuItems}
                    session={session}
                  />
                ))}
                <div className={classes.grow} />
                <Tooltip title="Rename Session" arrow>
                  <EditableTypography
                    value={name}
                    setValue={handleNameChange}
                    variant="body1"
                    classes={{
                      inputBase: classes.inputBase,
                      inputRoot: classes.inputRoot,
                      inputFocused: classes.inputFocused,
                    }}
                  />
                </Tooltip>
                {HeaderButtons}
                <div className={classes.grow} />
                <div style={{ width: 150, maxHeight: 48 }}>
                  <Logo session={session} />
                </div>
              </Toolbar>
            </AppBar>
          </div>
          <div className={classes.components}>
            {views.length ? (
              views.map(view => {
                const viewType = pluginManager.getViewType(view.type)
                if (!viewType) {
                  throw new Error(`unknown view type ${view.type}`)
                }
                const { ReactComponent } = viewType
                return (
                  <ViewContainer
                    key={`view-${view.id}`}
                    view={view}
                    onClose={() => {
                      session.removeView(view)
                      session.notify(`A view has been closed`, 'info', {
                        name: 'undo',
                        onClick: () => {
                          pluginManager.rootModel.history.undo()
                        },
                      })
                    }}
                  >
                    <Suspense fallback={<div>Loading...</div>}>
                      <ReactComponent
                        model={view}
                        session={session}
                        getTrackType={pluginManager.getTrackType}
                      />
                    </Suspense>
                  </ViewContainer>
                )
              })
            ) : (
              <Paper className={classes.selectPaper}>
                <Typography>Select a view to launch</Typography>
                <Select
                  value={value}
                  onChange={event => setValue(event.target.value)}
                >
                  {viewTypes.map(({ name }: { name: string }) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  onClick={() => {
                    session.addView(value, {})
                  }}
                  variant="contained"
                  color="primary"
                >
                  Launch view
                </Button>
              </Paper>
            )}

            {/* blank space at the bottom of screen allows scroll */}
            <div style={{ height: 300 }} />
          </div>
        </div>

        {activeWidgets.size > 0 && minimized ? (
          <Tooltip title="Open drawer widget">
            <Fab
              className={
                drawerPosition === 'right' ? classes.fabRight : classes.fabLeft
              }
              color="primary"
              data-testid="drawer-maximize"
              onClick={() => session.showWidgetDrawer()}
            >
              <LaunchIcon />
            </Fab>
          </Tooltip>
        ) : null}

        {drawerVisible && drawerPosition === 'right' ? (
          <DrawerWidget session={session} />
        ) : null}

        <Snackbar session={session} />
      </div>
    )
  },
)

export default App
