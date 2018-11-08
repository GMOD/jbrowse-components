import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Block from './Block'

export default class TrackBlocks extends Component {
  static propTypes = {
    blocks: PropTypes.arrayOf(PropTypes.object).isRequired,
    trackId: PropTypes.string.isRequired,
    offsetPx: PropTypes.number.isRequired,
    bpPerPx: PropTypes.number.isRequired,
    onHorizontalScroll: PropTypes.func.isRequired,
    width: PropTypes.number.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = { mouseDragging: false }

    this.mouseUp = this.mouseUp.bind(this)
    this.mouseDown = this.mouseDown.bind(this)
    this.mouseMove = this.mouseMove.bind(this)
    this.mouseLeave = this.mouseLeave.bind(this)
    this.wheel = this.wheel.bind(this)

    const { bpPerPx } = props
    this.blockWidths = props.blocks.map(
      ({ start, end }) => Math.abs(end - start) / bpPerPx,
    )
    this.totalBlockWidths = this.blockWidths.reduce((a, b) => a + b, 0)
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
    const { blocks, trackId, offsetPx, bpPerPx, width } = this.props
    return (
      <div
        className="track-blocks"
        key={`blocks:${trackId}`}
        style={{
          gridRow: trackId,
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
        {blocks.map(block => {
          const { refName, start, end } = block
          const comp = (
            <Block
              start={block.start}
              end={block.end}
              refName={block.ref}
              width={block.widthPx}
              key={`${refName}:${start}..${end}`}
              offset={offsetPx}
              bpPerPx={bpPerPx}
            >
              {block.content}
            </Block>
          )
          return comp
        })}
      </div>
    )
  }
}
