import { getSession } from '@gmod/jbrowse-core/util'
import AppBar from '@material-ui/core/AppBar'
import { makeStyles } from '@material-ui/styles'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Input from '@material-ui/core/Input'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'

import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState } from 'react'
import DropDownMenu from './DropDownMenu'

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  grow: {
    flexGrow: 1,
  },
  input: {
    color: theme.palette.primary.contrastText,
  },
  icon: {
    color: theme.palette.primary.contrastText,
  },
}))

function MainMenuBar(props) {
  const { model } = props
  const session = getSession(model)

  const classes = useStyles()
  const [editing, setEditing] = useState(false)
  const [editedName, setEditedName] = useState('')

  function handleEditToggle() {
    if (editing) {
      if (editedName !== session.name) session.renameCurrentSession(editedName)
      setEditedName('')
      setEditing(false)
    } else {
      setEditedName(session.name)
      setEditing(true)
    }
  }

  function handleSessionNameChange(event) {
    setEditedName(event.target.value)
  }

  const sessionNameComponent = editing ? (
    <Input
      className={classes.input}
      autoFocus
      value={editedName}
      onChange={handleSessionNameChange}
    />
  ) : (
    <Typography>{session.name}</Typography>
  )

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
        {sessionNameComponent}
        <div className={classes.grow}>
          <IconButton onClick={handleEditToggle}>
            <Icon className={classes.icon}>{editing ? 'check' : 'edit'}</Icon>
          </IconButton>{' '}
        </div>
        <Typography variant="h6" color="inherit">
          JBrowse
        </Typography>
        <div
          style={{
            width: session.activeDrawerWidgets.size ? session.drawerWidth : 0,
          }}
        />
      </Toolbar>
    </AppBar>
  )
}

MainMenuBar.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(MainMenuBar)
