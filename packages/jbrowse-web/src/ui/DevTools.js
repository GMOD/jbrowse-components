import React from 'react'
import { observer, PropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { withStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'

import { readConfObject } from '@gmod/jbrowse-core/configuration'

const styles = theme => ({
  developer: {
    background: 'white',
    display: 'block',
  },
})

function addView(session, type) {
  // clone the last view if there is one
  if (session.views.length) {
    session.addViewFromAnotherView(
      type,
      session.views[session.views.length - 1],
    )
  } else {
    // otherwise use the first define dataset
    if (!session.datasets.length)
      throw new Error(`Must add a dataset before adding a view`)
    session.addViewOfDataset(type, readConfObject(session.datasets[0], 'name'))
  }
}

function DeveloperTools({ classes, session }) {
  return (
    <div className={classes.developer}>
      <h3>Developer tools</h3>
      <button
        type="button"
        onClick={() => {
          addView(session, 'LinearGenomeView')
        }}
      >
        Add linear view
      </button>
      <button
        type="button"
        onClick={() => {
          addView(session, 'CircularView')
        }}
      >
        Add circular view
      </button>

      <Button
        disabled={!session.history.canUndo}
        onClick={() => session.history.undo()}
      >
        undo
        <Icon>undo</Icon>
      </Button>
      <Button
        disabled={!session.history.canRedo}
        onClick={() => session.history.redo()}
      >
        <Icon>redo</Icon>
        redo
      </Button>

      <Button onClick={() => getRoot(session).setDefaultSession()}>
        <Icon>clear</Icon>
        clear session
      </Button>
    </div>
  )
}

DeveloperTools.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  session: PropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(DeveloperTools))
