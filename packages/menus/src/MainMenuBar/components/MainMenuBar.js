import { LogoFull } from '@gmod/jbrowse-core/ui'
import { getSession } from '@gmod/jbrowse-core/util'
import AppBar from '@material-ui/core/AppBar'
import InputBase from '@material-ui/core/InputBase'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import DropDownMenu from './DropDownMenu'

const useStyles = makeStyles(theme => {
  return {
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
    sizer: {
      position: 'absolute',
      top: 0,
      left: 0,
      visibility: 'hidden',
      height: 0,
      overflow: 'scroll',
      whiteSpace: 'pre',
    },
    inputRoot: {
      padding: theme.spacing(0.5),
      '&:hover': {
        backgroundColor: theme.palette.primary.light,
      },
    },
    inputFocused: {
      borderStyle: 'solid',
      borderRadius: theme.shape.borderRadius,
      borderColor: theme.palette.secondary.main,
      borderWidth: 2,
      backgroundColor: theme.palette.primary.light,
    },
  }
})

function MainMenuBar(props) {
  const { model } = props
  const session = getSession(model)

  const classes = useStyles()
  const [editedName, setEditedName] = useState('')
  const [width, setWidth] = useState(0)
  const [sizerNode, setSizerNode] = useState(null)
  const [inputNode, setInputNode] = useState(null)

  useEffect(() => {
    setEditedName(session.name)
  }, [session.name])

  const scrollWidth = sizerNode && sizerNode.scrollWidth
  const padding = 12 + 1.5 * editedName.length
  if (scrollWidth + padding !== width) setWidth(scrollWidth + padding)

  const sizerRef = node => {
    setSizerNode(node)
  }

  const inputRef = node => {
    setInputNode(node)
  }

  function handleBlur() {
    if (editedName !== session.name) {
      if (
        session.savedSessionNames &&
        session.savedSessionNames.includes(editedName)
      ) {
        setEditedName(session.name)
        console.error(
          `Cannot rename session to ${editedName}, a saved session with that name already exists`,
        )
      } else session.renameCurrentSession(editedName)
    }
  }

  function handleKeyDown(event) {
    // "Enter"
    if (event.keyCode === 13) inputNode.blur()
    // "Esc"
    else if (event.keyCode === 27) {
      setEditedName(session.name)
      inputNode.blur()
    }
  }

  function handleChange(event) {
    setEditedName(event.target.value)
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
        <Tooltip title="Rename Session">
          <InputBase
            inputRef={inputRef}
            className={classes.input}
            style={{ width }}
            classes={{ root: classes.inputRoot, focused: classes.inputFocused }}
            value={editedName}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </Tooltip>
        <div ref={sizerRef} className={classes.sizer}>
          {editedName}
        </div>
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
