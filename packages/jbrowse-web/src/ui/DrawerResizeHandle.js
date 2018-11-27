import { withStyles } from '@material-ui/core/styles'
import ReactPropTypes from 'prop-types'
import React from 'react'

const styles = {
  resizeHandle: {
    cursor: 'col-resize',
    width: 5,
  },
}

@withStyles(styles)
class DrawerResizeHandle extends React.Component {
  static propTypes = {
    classes: ReactPropTypes.shape({
      resizeHandle: ReactPropTypes.string.isRequired,
    }).isRequired,
    onHorizontalDrag: ReactPropTypes.func.isRequired,
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
    const { onHorizontalDrag } = this.props
    const { mouseDragging } = this.state
    if (mouseDragging && this.previousMouseX !== undefined) {
      const distance = event.clientX - this.previousMouseX
      if (distance) {
        const distMoved = onHorizontalDrag(distance)
        if (!distMoved) return
      }
    }
    this.previousMouseX = event.clientX
  }

  mouseUp() {
    window.removeEventListener('mouseup', this.mouseUp, true)
    window.removeEventListener('mousemove', this.mouseMove, true)
    this.setState({ mouseDragging: false })
  }

  mouseLeave(event) {
    event.preventDefault()
  }

  render() {
    const { classes } = this.props
    return (
      <div
        onMouseDown={this.mouseDown}
        onMouseMove={this.mouseMove}
        onMouseLeave={this.mouseLeave}
        onMouseUp={this.mouseUp}
        role="presentation"
        className={classes.resizeHandle}
      />
    )
  }
}

export default DrawerResizeHandle
