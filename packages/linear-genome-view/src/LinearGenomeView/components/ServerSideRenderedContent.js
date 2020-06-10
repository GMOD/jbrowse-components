import React, { Component } from 'react'
import ReactPropTypes from 'prop-types'
import { observer, PropTypes } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { isAlive, isStateTreeNode, getSnapshot } from 'mobx-state-tree'

/**
 * A block whose content is rendered outside of the main thread and hydrated by this
 * component.
 */
class ServerSideRenderedContent extends Component {
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
      //
      // note: the timeout param to rIC below helps when you are doing
      // a long continuous scroll, it forces it to evaluate because
      // otherwise the continuous scroll would never give it time to do
      // so
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
              regions: [serializedRegion],
              ...renderProps,
            },
            null,
          )

          hydrate(mainThreadRendering, domNode.firstChild)
          this.hydrated = true
        },
        { timeout: 300 },
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
ServerSideRenderedContent.propTypes = {
  model: PropTypes.observableObject.isRequired,
}

export default observer(ServerSideRenderedContent)
