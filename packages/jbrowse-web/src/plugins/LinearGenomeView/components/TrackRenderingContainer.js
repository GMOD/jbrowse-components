import React, { Component } from 'react'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'

/**
 * mostly does UI gestures: drag scrolling, etc
 */
@observer
class TrackRenderingContainer extends Component {
  static propTypes = {
    trackId: PropTypes.string.isRequired,
    onHorizontalScroll: PropTypes.func.isRequired,
    width: PropTypes.number.isRequired,
    children: PropTypes.node,
  }

  static defaultProps = {
    children: undefined,
  }

  constructor(props) {
    super(props)
    this.state = { mouseDragging: false }

    this.mouseUp = this.mouseUp.bind(this)
    this.mouseDown = this.mouseDown.bind(this)
    this.mouseMove = this.mouseMove.bind(this)
    this.mouseLeave = this.mouseLeave.bind(this)
    this.wheel = this.wheel.bind(this)
  }

  mouseDown() {
    this.setState({ mouseDragging: true })
  }

  wheel(event) {
    const { onHorizontalScroll } = this.props
    const delta = { x: 0, y: 0 }
    if ('wheelDeltaX' in event) {
      delta.x = event.wheelDeltaX / 2
      delta.y = event.wheelDeltaY / 2
    } else if ('deltaX' in event) {
      delta.x =
        Math.abs(event.deltaY) > Math.abs(2 * event.deltaX) ? 0 : event.deltaX
      delta.y = event.deltaY * -10
    } else if (event.wheelDelta) {
      delta.y = event.wheelDelta / 2
      if (window.opera) delta.y = -delta.y
    } else if (event.detail) {
      delta.y = -event.detail * 100
    }

    delta.x = Math.round(delta.x)
    delta.y = Math.round(delta.y)

    if (delta.x) onHorizontalScroll(delta.x)
    // TODO vertical scrolling
    // if (delta.y)
    //   // 60 pixels per mouse wheel event
    //   this.setY(this.getY() - delta.y)
    event.preventDefault()
  }

  mouseMove(event) {
    const { onHorizontalScroll } = this.props
    const { mouseDragging } = this.state
    if (mouseDragging && this.previousMouseX !== undefined) {
      const distance = event.clientX - this.previousMouseX
      if (distance) onHorizontalScroll(-distance)
    }
    this.previousMouseX = event.clientX
  }

  mouseLeave(event) {
    event.preventDefault()

    this.setState({ mouseDragging: false })
  }

  mouseUp() {
    this.setState({ mouseDragging: false })
  }

  render() {
    const { trackId, width, children } = this.props
    return (
      <div
        className="TrackRenderingContainer"
        key={`rendering:${trackId}`}
        style={{
          gridRow: `track-${trackId}`,
          gridColumn: 'blocks',
          width: `${width}px`,
        }}
        onMouseDown={this.mouseDown}
        onMouseMove={this.mouseMove}
        onMouseLeave={this.mouseLeave}
        onMouseUp={this.mouseUp}
        onWheel={this.wheel}
        role="presentation"
      >
        {children}
      </div>
    )
  }
}

export default TrackRenderingContainer
