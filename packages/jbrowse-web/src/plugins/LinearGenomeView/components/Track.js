import React, { Component } from 'react'
import { observer } from 'mobx-react'
import PropTypes from 'prop-types'
import { withStyles } from '@material-ui/core'

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
    onHorizontalScroll: PropTypes.func.isRequired,
  }

  static defaultProps = { children: null }

  constructor(props) {
    super(props)
    this.state = { mouseDragging: false }
    this.mainNode = React.createRef()

    this.mouseUp = this.mouseUp.bind(this)
    this.mouseDown = this.mouseDown.bind(this)
    this.mouseMove = this.mouseMove.bind(this)
    this.mouseLeave = this.mouseLeave.bind(this)
    this.wheel = this.wheel.bind(this)
  }

  componentDidMount() {
    if (this.mainNode.current)
      this.mainNode.current.addEventListener('wheel', this.wheel, {
        passive: false,
      })
  }

  mouseDown(event) {
    this.setState({ mouseDragging: true, previousMouseX: event.clientX })
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

    if (delta.x) onHorizontalScroll(-delta.x)
    // TODO vertical scrolling
    // if (delta.y)
    //   // 60 pixels per mouse wheel event
    //   this.setY(this.getY() - delta.y)
    event.preventDefault()
  }

  mouseMove(event) {
    const { onHorizontalScroll } = this.props
    const { mouseDragging, previousMouseX } = this.state
    if (mouseDragging && previousMouseX !== undefined) {
      const distance = event.clientX - previousMouseX
      if (distance) onHorizontalScroll(-distance)
    }
    this.setState({ previousMouseX: event.clientX })
  }

  mouseLeave(event) {
    event.preventDefault()

    this.setState({ mouseDragging: false })
  }

  mouseUp() {
    this.setState({ mouseDragging: false })
  }

  render() {
    const { classes, children, trackId } = this.props
    return (
      <div
        data-testid={`track-${trackId}`}
        className={classes.track}
        onMouseDown={this.mouseDown}
        onMouseMove={this.mouseMove}
        onMouseLeave={this.mouseLeave}
        onMouseUp={this.mouseUp}
        ref={this.mainNode}
        role="presentation"
      >
        {children}
      </div>
    )
  }
}

export default withStyles(styles)(observer(Track))
