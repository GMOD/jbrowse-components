import AppBar from '@material-ui/core/AppBar'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import { observer, PropTypes } from 'mobx-react'
import React from 'react'
import DrawerWidget from './DrawerWidget'
import DropDownMenu from './DropDownMenu'
import EditableTypography from './EditableTypography'
import LogoFull from './LogoFull'
import Snackbar from './Snackbar'
import ViewContainer from './ViewContainer'

const useStyles = makeStyles(theme => ({
  '@global': {
    html: {
      'font-family': 'Roboto',
    },
  },
  root: {
    display: 'grid',
    height: '100vh',
    width: '100%',
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

function App({ session }) {
  const classes = useStyles()
  const { pluginManager } = session

  const { visibleWidget, drawerWidth } = session

  function handleNameChange(newName) {
    if (
      session.savedSessionNames &&
      session.savedSessionNames.includes(newName)
    ) {
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
          visibleWidget ? ` [drawer] ${drawerWidth}px` : ''
        }`,
      }}
    >
      <div className={classes.menuBarAndComponents}>
        <div className={classes.menuBar}>
          <AppBar className={classes.appBar} position="static">
            <Toolbar variant="dense">
              {session.menus.map(menu => (
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
                  value={session.name}
                  setValue={handleNameChange}
                  variant="body1"
                  classes={{
                    inputBase: classes.inputBase,
                    inputRoot: classes.inputRoot,
                    inputFocused: classes.inputFocused,
                  }}
                />
              </Tooltip>
              <div className={classes.grow} />
              <div style={{ width: 150, maxHeight: 48 }}>
                <LogoFull variant="white" />
              </div>
            </Toolbar>
          </AppBar>
        </div>
        <div className={classes.components}>
          {session.views.map(view => {
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
                <ReactComponent
                  model={view}
                  session={session}
                  getTrackType={pluginManager.getTrackType}
                />
              </ViewContainer>
            )
          })}
          <div style={{ height: 300 }} />
        </div>
      </div>

      {visibleWidget ? <DrawerWidget session={session} /> : null}
      <Snackbar session={session} />
    </div>
  )
}

App.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default observer(App)
