import React, { Component } from 'react'
import { findDOMNode } from 'react-dom'
import propTypes from 'prop-types'

// renders initially as a <script> tag, but changes itself
// to be a canvas after being mounted in the DOM.
// this allows server-side rendering of canvas-based components in a web worker
// without requiring

// if it has a string of image data, draws itself as a script tag with the image data in it
// upon mounting and updating, if it has not converted to canvas yet, it makes itself a
// canvas and fill into it
export default class SsrCanvas extends Component {
  static propTypes = {
    imageData: propTypes.oneOfType([propTypes.func, propTypes.string])
      .isRequired,
    width: propTypes.number.isRequired,
    height: propTypes.number.isRequired,
  }

  // constructor(props) {
  //   super(props)
  // }

  componentDidMount() {
    this.makeCanvas()
  }

  componentDidUpdate() {
    this.makeCanvas()
  }

  makeCanvas() {
    const { width, height } = this.props
    const container = findDOMNode(this) // eslint-disable-line react/no-find-dom-node
    let { imageData } = this.props
    if (!imageData) {
      const scriptTag = container.firstElementChild
      imageData = scriptTag.innerHtml
      console.log(`got image data from DOM`, imageData)
    }
    debugger
    while (container.firstChild) container.removeChild(container.firstChild)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    container.appendChild(canvas)
  }

  encodeImageData(inputData) {
    // if the image data is a function, call it
    const data = typeof inputData === 'function' ? inputData() : inputData
    return data
  }

  decodeImageData(data) {
    return data
  }

  render() {
    const { imageData } = this.props
    return (
      <div>
        <script type="text/x-ssr-canvas">
          {this.encodeImageData(imageData)}
        </script>
      </div>
    )
  }
}
