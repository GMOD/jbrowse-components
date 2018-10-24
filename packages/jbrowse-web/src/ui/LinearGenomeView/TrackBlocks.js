import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Block from './Block'

export default class TrackBlocks extends Component {
  propTypes = {
    blocks: PropTypes.arrayOf(PropTypes.object).isRequired,
    trackId: PropTypes.number.isRequired,
    offsetPx: PropTypes.number.isRequired,
    bpPerPx: PropTypes.number.isRequired,
    onHorizontalScroll: PropTypes.func.isRequired,
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
    this.setState({ mouseDragging: true })
  }

  mouseMove(event) {
    const { onHorizontalScroll } = this.props
    const { mouseDragging } = this.state
    if (mouseDragging && this.previousMouseX !== undefined) {
      const distance = event.clientX - this.previousMouseX
      if (distance) onHorizontalScroll(distance)
    }
    this.previousMouseX = event.clientX
  }

  mouseLeave(event) {
    this.setState({ mouseDragging: false })
  }

  mouseUp(event) {
    this.setState({ mouseDragging: false })
  }

  render() {
    const { blocks, trackId, offsetPx, bpPerPx } = this.props
    return (
      <div
        className="track-blocks"
        key={`blocks:${trackId}`}
        style={{ gridRow: trackId, gridColumn: 'blocks' }}
        onMouseDown={this.mouseDown}
        onMouseMove={this.mouseMove}
        onMouseLeave={this.mouseLeave}
        onMouseUp={this.mouseUp}
        role="presentation"
      >
        {blocks.map(block => {
          const comp = (
            <Block
              key={`${block.refName}:${block.start}..${block.end}`}
              offset={offsetPx}
              bpPerPx={bpPerPx}
              start={block.start}
              end={block.end}
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
