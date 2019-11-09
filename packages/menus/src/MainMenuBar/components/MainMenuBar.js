import { getSession } from '@gmod/jbrowse-core/util'
import AppBar from '@material-ui/core/AppBar'
import InputBase from '@material-ui/core/InputBase'
import { makeStyles } from '@material-ui/core/styles'
import Toolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import { values } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import DropDownMenu from './DropDownMenu'

const useStyles = makeStyles(theme => {
  const light = theme.palette.type === 'light'
  const backgroundColor = light
    ? 'rgba(0, 0, 0, 0.09)'
    : 'rgba(255, 255, 255, 0.09)'
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
        backgroundColor: light
          ? 'rgba(0, 0, 0, 0.13)'
          : 'rgba(255, 255, 255, 0.13)',
        // Reset on touch devices, it doesn't add specificity
        '@media (hover: none)': {
          backgroundColor,
        },
      },
      '&$focused': {
        backgroundColor: light
          ? 'rgba(0, 0, 0, 0.09)'
          : 'rgba(255, 255, 255, 0.09)',
      },
    },
    inputFocused: {
      borderStyle: 'solid',
      borderRadius: theme.shape.borderRadius,
      borderColor: theme.palette.secondary.main,
      borderWidth: 2,
      backgroundColor: light
        ? 'rgba(0, 0, 0, 0.09)'
        : 'rgba(255, 255, 255, 0.09)',
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
  const padding = 32
  if (scrollWidth + padding !== width) setWidth(scrollWidth + padding)

  const sizerRef = node => {
    setSizerNode(node)
  }

  const inputRef = node => {
    setInputNode(node)
  }

  function handleBlur() {
    if (editedName !== session.name) {
      if (session.savedSessionNames.includes(editedName)) {
        setEditedName(session.name)
        console.error(
          `Cannot rename session to ${editedName}, a saved session with that name already exists`,
        )
      } else session.renameCurrentSession(editedName)
    }
  }

  function handleChange(event) {
    setEditedName(event.target.value)
  }

  const sessionNameComponent = (
    <>
      <Tooltip title="Rename">
        <InputBase
          inputRef={inputRef}
          className={classes.input}
          style={{ width }}
          classes={{ root: classes.inputRoot, focused: classes.inputFocused }}
          value={editedName}
          onChange={handleChange}
          // Remove focus on pressing "Esc" or "Enter"
          onKeyDown={event => {
            if ([13, 27].includes(event.keyCode)) inputNode.blur()
          }}
          onBlur={handleBlur}
        />
      </Tooltip>
      <div ref={sizerRef} className={classes.sizer}>
        {editedName}
      </div>
    </>
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
        <div className={classes.grow} />
        <Typography variant="h6" color="inherit">
          JBrowse
        </Typography>
      </Toolbar>
    </AppBar>
  )
}

MainMenuBar.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(MainMenuBar)
