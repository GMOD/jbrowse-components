import React, { Component } from 'react'
import { PropTypes } from 'prop-types'
import { PropTypes as MobxPropTypes } from 'mobx-react'

function getBp(px, model) {
  const regions = model.displayedRegions
  const bp = (model.offsetPx + px - model.controlsWidth) * model.bpPerPx + 1
  let bpSoFar = 0
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i]
    if (region.end - region.start + bpSoFar > bp && bpSoFar <= bp) {
      return Object.assign({}, region, { offset: bp - bpSoFar })
    }
    bpSoFar += region.end - region.start
  }
  return undefined
}

class Rubberband extends Component {
  static defaultProps = {
    style: {},
    children: undefined,
  }

  static propTypes = {
    model: MobxPropTypes.objectOrObservableObject.isRequired,
    children: PropTypes.node,
    style: PropTypes.objectOf(PropTypes.any),
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
      const leftBp = getBp(leftPx, model)
      const rightBp = getBp(rightPx, model)
      console.log(leftBp, rightBp)
      // model.zoomToThisLocation()
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
    const { style, children } = this.props
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
        {children}
      </div>
    )
  }
}

export default Rubberband
