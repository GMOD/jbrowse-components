import { EditableTypography, LogoFull } from '@gmod/jbrowse-core/ui'
import { getSession } from '@gmod/jbrowse-core/util'
import AppBar from '@material-ui/core/AppBar'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import DropDownMenu from './DropDownMenu'

const useStyles = makeStyles(theme => ({
  root: {
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

function MainMenuBar(props) {
  const { model } = props
  const session = getSession(model)

  const classes = useStyles()

  function handleNameChange(newName) {
    if (
      session.savedSessionNames &&
      session.savedSessionNames.includes(newName)
    ) {
      session.pushSnackbarMessage(
        `Cannot rename session to "${newName}", a saved session with that name already exists`,
      )
    } else {
      session.renameCurrentSession(newName)
    }
  }

  return (
    <AppBar className={classes.root} position="static">
      <Toolbar variant="dense">
        {values(model.menus).map(menu => (
          <DropDownMenu
            key={menu.name}
            menuTitle={menu.name}
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
  )
}

MainMenuBar.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(MainMenuBar)
