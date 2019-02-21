import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { withStyles } from '@material-ui/core'

const styles = {
  rubberband: {
    height: '100%',
    background: '#aad8',
    position: 'absolute',
  },
}

class Rubberband extends Component {
  static defaultProps = {
    children: undefined,
  }

  static propTypes = {
    model: MobxPropTypes.objectOrObservableObject.isRequired,
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    children: ReactPropTypes.node,
  }

  state = {}

  onMouseDown = ({ clientX }) => {
    this.setState({
      rubberband: [clientX, clientX + 1],
    })
    window.addEventListener('mousemove', this.mouseMove, true)
    window.addEventListener('mouseup', this.mouseUp, true)
  }

  mouseUp = () => {
    const { rubberband } = this.state
    const { model } = this.props
    if (rubberband) {
      let [leftPx, rightPx] = rubberband
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      if (rightPx - leftPx > 3) {
        const leftOffset = model.pxToBp(leftPx)
        const rightOffset = model.pxToBp(rightPx)
        model.moveTo(leftOffset, rightOffset)
      }
    }
    this.setState(() => ({
      rubberband: undefined,
    }))
    window.removeEventListener('mouseup', this.mouseUp, true)
    window.removeEventListener('mousemove', this.mouseMove, true)
  }

  mouseMove = ({ clientX }) => {
    const { rubberband } = this.state
    if (rubberband) {
      this.setState({
        rubberband: [rubberband[0], clientX],
      })
    }
  }

  render() {
    const { children, classes } = this.props
    const { rubberband } = this.state

    let leftPx
    let rightPx
    if (rubberband) {
      ;[leftPx, rightPx] = rubberband
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
    }
    return (
      <div
        onMouseDown={this.onMouseDown}
        role="presentation"
        style={{ cursor: 'crosshair', zIndex: 999 }}
      >
        {rubberband ? (
          <div
            id="rubberband"
            className={classes.rubberband}
            style={{
              left: `${leftPx}px`,
              width: `${rightPx - leftPx}px`,
              zIndex: 9999,
            }}
          />
        ) : null}
        {children}
      </div>
    )
  }
}

export default withStyles(styles)(Rubberband)
