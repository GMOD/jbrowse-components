import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import React from 'react'
import SessionMenu from './DevTools/SessionMenu'
import ViewMenu from './DevTools/ViewMenu'

const useStyles = makeStyles({
  developer: {
    background: 'white',
    display: 'block',
  },
})

function DeveloperTools({ session }) {
  const classes = useStyles()

  return (
    <div className={classes.developer}>
      <h3>Developer tools</h3>
      <ViewMenu session={session} />

      <Button
        color="secondary"
        disabled={!session.history.canUndo}
        onClick={() => session.history.undo()}
      >
        undo
        <Icon>undo</Icon>
      </Button>
      <Button
        color="secondary"
        disabled={!session.history.canRedo}
        onClick={() => session.history.redo()}
      >
        <Icon>redo</Icon>
        redo
      </Button>

      <SessionMenu session={session} />
    </div>
  )
}

DeveloperTools.propTypes = {
  session: PropTypes.observableObject.isRequired,
}

export default observer(DeveloperTools)
