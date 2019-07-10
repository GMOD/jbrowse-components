import { withStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { Component } from 'react'

const styles = {
  track: {
    position: 'relative',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    width: '100%',
    background: '#555',
    minHeight: '100%',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */

class Track extends Component {
  static propTypes = {
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
    trackId: PropTypes.string.isRequired,
    children: PropTypes.node,
  }

  static defaultProps = { children: null }

  constructor(props) {
    super(props)
  }

  render() {
    const { classes, children, trackId } = this.props
    return (
      <div
        data-testid={`track-${trackId}`}
        className={classes.track}
        role="presentation"
      >
        {children}
      </div>
    )
  }
}

export default withStyles(styles)(observer(Track))
