import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { isAlive } from 'mobx-state-tree'

import { requestIdleCallback } from 'request-idle-callback'

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
    const { data, region, html, renderProps, renderingComponent } = model
    const domNode = this.ssrContainerNode.current
    if (domNode && model.filled) {
      if (this.hydrated) unmountComponentAtNode(domNode.firstChild)
      domNode.innerHTML = `<div className="ssr-container-inner"></div>`
      domNode.firstChild.innerHTML = html
      // defer main-thread rendering and hydration for when
      // we have some free time. helps keep the framerate up.
      requestIdleCallback(() => {
        if (!isAlive(model)) return
        const mainThreadRendering = React.createElement(
          renderingComponent,
          {
            ...data,
            region,
            ...renderProps,
          },
          null,
        )
        requestIdleCallback(() => {
          if (!isAlive(model)) return
          hydrate(mainThreadRendering, domNode.firstChild)
          this.hydrated = true
        })
      })
    }
  }

  render() {
    const { model } = this.props
    return (
      <div
        ref={this.ssrContainerNode}
        data-html-size={model.html.length}
        className="ssr-container"
      />
    )
  }
}

export default ServerSideRenderedContent
