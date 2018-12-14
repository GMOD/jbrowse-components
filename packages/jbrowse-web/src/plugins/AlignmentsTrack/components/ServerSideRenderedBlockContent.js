import React, { Component } from 'react'
import { observer, PropTypes } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { setLivelinessChecking } from 'mobx-state-tree'

setLivelinessChecking('error')

function LoadingMessage() {
  return <div className="loading">Loading ...</div>
}

function ErrorMessage({ error }) {
  return <div className="error">{error.message}</div>
}
ErrorMessage.propTypes = {
  error: PropTypes.objectOrObservableObject.isRequired,
}

@observer
class ServerSideRenderedBlockContent extends Component {
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
    if (this.hydrated) unmountComponentAtNode(this.ssrContainerNode.current)
  }

  doHydrate() {
    const { model } = this.props
    if (model.filled) {
      const { data, region, html, rendererType, renderProps } = model
      const domNode = this.ssrContainerNode.current
      domNode.innerHTML = html
      const mainThreadRendering = React.createElement(
        rendererType.ReactComponent,
        {
          ...data,
          region,
          ...renderProps,
        },
        null,
      )
      hydrate(mainThreadRendering, domNode)
      this.hydrated = true
    }
  }

  render() {
    const { model } = this.props
    if (model.error) return <ErrorMessage error={model.error} />
    if (!model.filled) return <LoadingMessage />
    return <div ref={this.ssrContainerNode} className="ssr-container" />
  }
}

export default ServerSideRenderedBlockContent
