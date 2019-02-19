import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { withStyles } from '@material-ui/core'

const styles = {
  rubberband: {
    height: '100%',
    background: '#aad8',
    position: 'absolute',
    gridColumn: '1 / auto',
    zIndex: 9999,
  },
}
function getBp(px, model) {
  const regions = model.displayedRegions
  const bp = (model.offsetPx + px - model.controlsWidth) * model.bpPerPx + 1
  let bpSoFar = 0
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i]
    if (region.end - region.start + bpSoFar > bp && bpSoFar <= bp) {
      return Object.assign({}, region, { offset: bp - bpSoFar, index: i })
    }
    bpSoFar += region.end - region.start
  }
  return undefined
}
function navigateToLocation(start, end, model) {
  // find locations in the modellist
  let bpSoFar = 0
  if (start.index === end.index) {
    bpSoFar += end.offset - start.offset
  } else {
    bpSoFar += start.end - start.offset
    bpSoFar += end.offset
    if (end.index - start.index > 2) {
      for (let i = start.index + 1; i < end.index - 1; i += 1) {
        bpSoFar +=
          model.displayedRegions[i].end - model.displayedRegions[i].start
      }
    }
  }
  let bpToStart = 0
  for (let i = 0; i < model.displayedRegions.length; i += 1) {
    const region = model.displayedRegions[i]
    if (start.index === i) {
      bpToStart += start.offset
      break
    } else {
      bpToStart += region.end - region.start
    }
  }
  const bpPerPx = bpSoFar / model.width
  const offsetPx = bpToStart / bpPerPx
  model.setNewView(bpPerPx, offsetPx)
  return 0
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
      const leftBp = getBp(leftPx, model)
      const rightBp = getBp(rightPx, model)
      navigateToLocation(leftBp, rightBp, model)
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
            }}
          />
        ) : null}
        {children}
      </div>
    )
  }
}

export default withStyles(styles)(Rubberband)
