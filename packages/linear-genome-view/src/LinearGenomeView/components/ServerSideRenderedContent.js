import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { observer, PropTypes } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { isAlive, isStateTreeNode, getSnapshot } from 'mobx-state-tree'

import BlockError from './BlockError'

class RenderErrorBoundary extends Component {
  static propTypes = {
    children: ReactPropTypes.node.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    console.error(error)
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error(error, errorInfo)
  }

  render() {
    const { hasError, error } = this.state
    if (hasError) {
      return <BlockError error={error} />
    }

    const { children } = this.props
    return children
  }
}

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
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
      requestIdleCallback(
        () => {
          if (!isAlive(model) || !isAlive(region)) return
          const serializedRegion = isStateTreeNode(region)
            ? getSnapshot(region)
            : region
          const mainThreadRendering = React.createElement(
            renderingComponent,
            {
              ...data,
              region: serializedRegion,
              ...renderProps,
            },
            null,
          )
          const errorHandler = React.createElement(
            RenderErrorBoundary,
            {},
            mainThreadRendering,
          )
          hydrate(errorHandler, domNode.firstChild)
          this.hydrated = true
        },
        { timeout: 50 },
      )
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

export default observer(ServerSideRenderedContent)
