import React from 'react'
import { observer, PropTypes } from 'mobx-react'
import { withStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'

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

function DeveloperTools({ classes, session, sessionNames, activateSession }) {
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
      <select
        onChange={event => activateSession(event.target.value)}
        value={session.name}
      >
        {sessionNames.map(name => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}

DeveloperTools.propTypes = {
  classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
  session: PropTypes.observableObject.isRequired,
  sessionNames: ReactPropTypes.arrayOf(ReactPropTypes.string).isRequired,
  activateSession: ReactPropTypes.func.isRequired,
}

export default withStyles(styles)(observer(DeveloperTools))
