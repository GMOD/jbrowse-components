import { withStyles } from '@material-ui/core/styles'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'

const styles = {
  rubberband: {
    height: '10000px',
    background: '#aad8',
    position: 'absolute',
    zIndex: 9999,
  },
  rubberBandContainer: {
    position: 'relative',
    cursor: 'crosshair',
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

  containerNode = React.createRef()

  onMouseDown = event => {
    event.preventDefault()
    const { clientX } = event
    const x = this.clientXToOffset(clientX)
    // console.log(x, this.props.model.pxToBp(x))

    this.setState({
      rubberband: [x, x + 1],
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
    const x = this.clientXToOffset(clientX)

    const { rubberband } = this.state
    if (rubberband) {
      this.setState({
        rubberband: [rubberband[0], x],
      })
    }
  }

  /**
   * convert clientX to an offsetX relative to our container dom node
   * @param {number} clientX
   */
  clientXToOffset(clientX) {
    if (!this.containerNode.current) return undefined
    let offset = 0
    for (
      let node = this.containerNode.current;
      node.offsetParent;
      node = node.offsetParent
    ) {
      offset += node.offsetLeft
    }
    return clientX - offset
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
        data-testid="rubberband_container"
        className={classes.rubberBandContainer}
        onMouseDown={this.onMouseDown}
        role="presentation"
        ref={this.containerNode}
      >
        {rubberband ? (
          <div
            className={classes.rubberband}
            style={{
              left: leftPx,
              width: rightPx - leftPx,
            }}
          />
        ) : null}
        {children}
      </div>
    )
  }
}

export default withStyles(styles)(Rubberband)
