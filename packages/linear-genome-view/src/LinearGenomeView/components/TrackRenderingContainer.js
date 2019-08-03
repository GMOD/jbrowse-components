/* eslint-disable react/require-default-props */
import React, { Component } from 'react'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core'

const styles = {
  trackRenderingContainer: {
    overflowY: 'auto',
    overflowX: 'hidden',
    background: '#333',
    whiteSpace: 'nowrap',
  },
}

/**
 * mostly does UI gestures: drag scrolling, etc
 */
class TrackRenderingContainer extends Component {
  constructor(props) {
    super(props)
    this.mainNode = React.createRef()
    this.wheel = this.wheel.bind(this)
  }

  componentDidMount() {
    if (this.mainNode.current)
      this.mainNode.current.addEventListener('wheel', this.wheel, {
        passive: false,
      })
  }

  wheel(event) {
    const { onHorizontalScroll, onVerticalScroll } = this.props
    onVerticalScroll(event.deltaY)
    onHorizontalScroll(event.deltaX)
    event.preventDefault()
  }

  render() {
    const { trackId, children, classes, scrollTop = 0 } = this.props

    if (this.mainNode.current) {
      this.mainNode.current.scrollTop = scrollTop
    }
    return (
      <div
        className={classes.trackRenderingContainer}
        ref={this.mainNode}
        style={{
          gridRow: `track-${trackId}`,
          gridColumn: 'blocks',
        }}
        role="presentation"
      >
        {children}
      </div>
    )
  }

  static propTypes = {
    scrollTop: PropTypes.number,
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
    trackId: PropTypes.string.isRequired,
    children: PropTypes.node,
    onHorizontalScroll: PropTypes.func.isRequired,
    onVerticalScroll: PropTypes.func.isRequired,
  }
}

export default withStyles(styles)(observer(TrackRenderingContainer))
