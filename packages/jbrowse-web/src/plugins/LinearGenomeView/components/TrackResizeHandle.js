import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { withStyles } from '@material-ui/core'

const styles = {
  dragHandle: {
    background: '#ccc',
    cursor: 'ns-resize',
    width: '100%',
    boxSizing: 'border-box',
    borderTop: '1px solid #fafafa',
  },
}

@withStyles(styles)
class TrackResizeHandle extends Component {
  static propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    trackId: ReactPropTypes.string.isRequired,
    onVerticalDrag: ReactPropTypes.func.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = { mouseDragging: false }

    this.mouseUp = this.mouseUp.bind(this)
    this.mouseDown = this.mouseDown.bind(this)
    this.mouseMove = this.mouseMove.bind(this)
    this.mouseLeave = this.mouseLeave.bind(this)
  }

  mouseDown(event) {
    event.preventDefault()
    window.addEventListener('mousemove', this.mouseMove, true)
    window.addEventListener('mouseup', this.mouseUp, true)
    this.setState({ mouseDragging: true })
  }

  mouseMove(event) {
    event.preventDefault()
    const { trackId, onVerticalDrag } = this.props
    const { mouseDragging } = this.state
    if (mouseDragging && this.previousMouseY !== undefined) {
      const distance = event.clientY - this.previousMouseY
      if (distance) onVerticalDrag(trackId, distance)
    }
    this.previousMouseY = event.clientY
  }

  mouseUp() {
    window.removeEventListener('mouseup', this.mouseUp, true)
    window.removeEventListener('mousemove', this.mouseMove, true)
    this.setState({ mouseDragging: false })
  }

  mouseLeave(event) {
    event.preventDefault()
    this.x = 1
  }

  render() {
    const { classes, trackId } = this.props
    return (
      <div
        onMouseDown={this.mouseDown}
        onMouseMove={this.mouseMove}
        onMouseLeave={this.mouseLeave}
        onMouseUp={this.mouseUp}
        role="presentation"
        className={classes.dragHandle}
        style={{
          gridRow: `resize-${trackId}`,
          gridColumn: 'span 2',
        }}
      />
    )
  }
}

export default TrackResizeHandle
