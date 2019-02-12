import React, { Component } from 'react'
import { PropTypes } from 'prop-types'
import Block from './Block'

class Rubberband extends Component {
  static defaultProps = {
    style: {},
  }

  static propTypes = {
    bpPerPx: PropTypes.number.isRequired,
    offsetPx: PropTypes.number.isRequired,
    style: PropTypes.objectOf(PropTypes.any),
  }

  state = {}

  onMouseDown = ({ clientX }) => {
    console.log('here2')
    this.setState({
      rubberband: [clientX, clientX + 1],
    })
    window.addEventListener('mousemove', this.mouseMove, true)
    window.addEventListener('mouseup', this.mouseUp, true)
  }

  mouseUp = () => {
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
    const { offsetPx, bpPerPx, style } = this.props
    const { rubberband } = this.state

    let leftPx
    let rightPx
    if (rubberband) {
      ;[leftPx, rightPx] = rubberband
      if (rightPx < leftPx) {
        ;[leftPx, rightPx] = [rightPx, leftPx]
      }
      const leftBp = (offsetPx + leftPx) * bpPerPx
      const rightBp = (offsetPx + rightPx) * bpPerPx
      console.log(leftBp, rightBp)
    }

    return (
      <div onMouseDown={this.onMouseDown} role="presentation" style={style}>
        {rubberband ? (
          <div
            id="rubberband"
            style={{
              left: `${leftPx}px`,
              width: `${rightPx - leftPx}px`,
              height: '100%',
              background: '#aad8',
              position: 'absolute',
              gridColumn: '1 / auto',
            }}
          />
        ) : (
          ''
        )}
      </div>
    )
  }
}

export default Rubberband
