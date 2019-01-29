import React from 'react'
import ReactPropTypes from 'prop-types'
import injectSheet from 'react-jss'

const styles = {
  root: {
    background: 'white',
  },
}

function ProteinView({ classes, gene, domains }) {
  debugger
  return <div className={classes.root}>oh hi</div>
}

ProteinView.propTypes = {
  classes: ReactPropTypes.shape({ root: ReactPropTypes.string.isRequired })
    .isRequired,
  gene: ReactPropTypes.shape({ symbol: ReactPropTypes.string.isRequired })
    .isRequired,
  domains: ReactPropTypes.arrayOf(
    ReactPropTypes.shape({ description: ReactPropTypes.string.isRequired }),
  ).isRequired,
}

export default injectSheet(styles)(ProteinView)
