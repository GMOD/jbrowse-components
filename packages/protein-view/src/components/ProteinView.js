import React from 'react'
import ReactPropTypes from 'prop-types'
import injectSheet from 'react-jss'

const styles = {
  root: {
    background: 'white',
  },
}

function ProteinView({ classes }) {
  return <div className={classes.root}>oh hi</div>
}

ProteinView.propTypes = {
  classes: ReactPropTypes.shape({ root: ReactPropTypes.string.isRequired })
    .isRequired,
}

export default injectSheet(styles)(ProteinView)
