import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
@observer
class ServerSideRenderedContent extends Component {
  static propTypes = {
    model: PropTypes.observableObject.isRequired,
  }

  constructor(props) {
    super(props)
    this.ssrContainerNode = React.createRef()
  }

  componentDidMount() {
    this.doHydrate()
  }

  componentDidUpdate() {
    this.doHydrate()
  }

  componentWillUnmount() {
    const domNode = this.ssrContainerNode.current
    if (domNode && this.hydrated) unmountComponentAtNode(domNode.firstChild)
  }

  doHydrate() {
    const { model } = this.props
    const { data, region, html, rendererType, renderProps } = model
    const domNode = this.ssrContainerNode.current
    if (domNode && model.filled) {
      if (this.hydrated) unmountComponentAtNode(domNode.firstChild)
      domNode.innerHTML = `<div className="ssr-container-inner"></div>`
      domNode.firstChild.innerHTML = html
      const mainThreadRendering = React.createElement(
        rendererType.ReactComponent,
        {
          ...data,
          region,
          ...renderProps,
        },
        null,
      )
      hydrate(mainThreadRendering, domNode.firstChild)
      this.hydrated = true
    }
  }

  render() {
    const { model } = this.props
    return (
      <div
        ref={this.ssrContainerNode}
        data-renderer-type={model.rendererType.name}
        data-html-size={model.html.length}
        className="ssr-container"
      />
    )
  }
}

export default ServerSideRenderedContent
