import { withStyles } from '@material-ui/core/styles'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import React from 'react'

const styles = {
  root: {
    cursor: 'col-resize',
    width: 4,
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
}

class DrawerResizeHandle extends React.Component {
  static propTypes = {
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
    onHorizontalDrag: PropTypes.func.isRequired,
    className: PropTypes.string,
  }

  static defaultProps = {
    className: '',
  }

  state = {
    // eslint can't tell that x is actually used in the mouseMove callback
    x: undefined, // eslint-disable-line react/no-unused-state
  }

  mouseDown = event => {
    const { clientX } = event
    this.setState({ x: clientX }) // eslint-disable-line react/no-unused-state
    event.preventDefault()
    window.addEventListener('mousemove', this.mouseMove, true)
    window.addEventListener('mouseup', this.mouseUp, true)
  }

  mouseMove = event => {
    this.setState(state => {
      const { clientX } = event
      const { x } = state
      const { onHorizontalDrag } = this.props
      const requestedDistance = clientX - x
      if (requestedDistance) {
        const actualDistance = onHorizontalDrag(requestedDistance)
        if (actualDistance) return { x: x + actualDistance }
      }
      return { x }
    })
  }

  mouseUp = () => {
    window.removeEventListener('mouseup', this.mouseUp, true)
    window.removeEventListener('mousemove', this.mouseMove, true)
    this.setState({ x: undefined }) // eslint-disable-line react/no-unused-state
  }

  mouseLeave = event => {
    event.preventDefault()
  }

  render() {
    const { classes, className } = this.props
    return (
      <div
        onMouseDown={this.mouseDown}
        onMouseLeave={this.mouseLeave}
        onMouseUp={this.mouseUp}
        role="presentation"
        className={classNames(className, classes.root)}
      />
    )
  }
}

export default withStyles(styles)(DrawerResizeHandle)
