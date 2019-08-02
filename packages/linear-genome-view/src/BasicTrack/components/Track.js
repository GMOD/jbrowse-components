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
    onHorizontalScroll: PropTypes.func.isRequired,
    onVerticalScroll: PropTypes.func.isRequired,
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
    const { onHorizontalScroll, onVerticalScroll } = this.props
    onHorizontalScroll(event.deltaX)
    onVerticalScroll(event.deltaY)
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
