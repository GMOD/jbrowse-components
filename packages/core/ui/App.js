import React, { Suspense } from 'react'
import { AppBar, Fab, Toolbar, Tooltip, makeStyles } from '@material-ui/core'
import LaunchIcon from '@material-ui/icons/Launch'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import DrawerWidget from './DrawerWidget'
import DropDownMenu from './DropDownMenu'
import EditableTypography from './EditableTypography'
import { LogoFull } from './Logo'
import Snackbar from './Snackbar'
import ViewContainer from './ViewContainer'
import { readConfObject } from '../configuration'

const useStyles = makeStyles(theme => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
    /* Based on: https://www.digitalocean.com/community/tutorials/css-scrollbars */
    /* The emerging W3C standard
       that is currently Firefox-only */
    '*': {
      'scrollbar-width': 'auto',
      'scrollbar-color': 'rgba(0,0,0,.5) rgba(128,128,128)',
    },
    /* Works on Chrome/Edge/Safari */
    '*::-webkit-scrollbar': {
      '-webkit-appearance': 'none',
      width: '12px',
    },
    '*::-webkit-scrollbar-thumb': {
      'background-color': 'rgba(0,0,0,.5)',
      '-webkit-box-shadow': '0 0 1px rgba(255,255,255,.5)',
    },
  },
  root: {
    display: 'grid',
    height: '100vh',
    width: '100%',
  },
  fab: {
    float: 'right',
    position: 'sticky',
    marginTop: theme.spacing(2),
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
}))

const Logo = observer(({ session }) => {
  const { configuration } = session
  const logoPath = readConfObject(configuration, 'logoPath')
  if (!logoPath?.uri) {
    return <LogoFull variant="white" />
  } else {
    return <img src={logoPath.uri} alt="Custom logo" />
  }
})

const App = observer(({ session, HeaderButtons }) => {
  const classes = useStyles()
  const { pluginManager } = getEnv(session)
  const {
    visibleWidget,
    drawerWidth,
    minimized,
    activeWidgets,
    savedSessionNames,
    name,
    menus,
    views,
  } = session

  function handleNameChange(newName) {
    if (savedSessionNames && savedSessionNames.includes(newName)) {
      session.notify(
        `Cannot rename session to "${newName}", a saved session with that name already exists`,
        'warning',
      )
    } else {
      session.renameCurrentSession(newName)
    }
  }

  return (
    <div
      className={classes.root}
      style={{
        gridTemplateColumns: `[main] 1fr${
          visibleWidget && !minimized ? ` [drawer] ${drawerWidth}px` : ''
        }`,
      }}
    >
      {session.DialogComponent ? (
        <Suspense fallback={<div />}>
          <session.DialogComponent
            handleClose={() => session.setDialogComponent(undefined, undefined)}
            {...session.DialogProps}
          />
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
          {views.map(view => {
            const viewType = pluginManager.getViewType(view.type)
            if (!viewType) {
              throw new Error(`unknown view type ${view.type}`)
            }
            const { ReactComponent } = viewType
            return (
              <ViewContainer
                key={`view-${view.id}`}
                view={view}
                onClose={() => session.removeView(view)}
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
          })}

          {/* blank space at the bottom of screen allows scroll */}
          <div style={{ height: 300 }} />
        </div>
      </div>

      {activeWidgets.size > 0 && minimized ? (
        <div className={classes.fab}>
          <Fab
            color="primary"
            size="small"
            aria-label="show"
            data-testid="drawer-maximize"
            style={{ float: 'right' }}
            onClick={() => {
              session.showWidgetDrawer()
            }}
          >
            <LaunchIcon />
          </Fab>
        </div>
      ) : null}

      {visibleWidget && !minimized ? <DrawerWidget session={session} /> : null}

      <Snackbar session={session} />
    </div>
  )
})

export default App
