import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession, rIC } from '@jbrowse/core/util'
import { BlockModel } from '@jbrowse/plugin-linear-genome-view'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React, { Component, useEffect, useRef } from 'react'
import { hydrate, unmountComponentAtNode } from 'react-dom'

// This code is nearly identical to the server side renderer from linear-genome-view except it
// doesn't have special handling for serializing region!
//
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}
class RenderErrorBoundary extends Component<{}, ErrorBoundaryState> {
  // eslint-disable-next-line react/static-property-placement
  static propTypes = {
    children: PropTypes.node.isRequired,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getDerivedStateFromError(error: any) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentDidCatch(error: any, errorInfo: any) {
    // You can also log the error to an error reporting service
    console.error(error, errorInfo)
  }

  render() {
    const { hasError, error } = this.state
    if (hasError && error?.message) {
      return <div style={{ color: 'red' }}>{error.message}</div>
    }

    const { children } = this.props
    return children
  }
}

function ServerSideRenderedContent(props: { model: BlockModel }) {
  const ssrContainerNode = useRef<HTMLDivElement>(null)

  const { model } = props
  const session = getSession(model)
  const theme = createJBrowseTheme(getConf(session, 'theme'))

  useEffect(() => {
    const domNode = ssrContainerNode.current
    function doHydrate() {
      const {
        data,
        html,
        renderProps,
        renderingComponent: RenderingComponent,
      } = model
      if (domNode && model.filled) {
        if (domNode) {
          unmountComponentAtNode(domNode)
        }
        domNode.innerHTML = html

        // defer main-thread rendering and hydration for when
        // we have some free time. helps keep the framerate up.
        //
        // note: the timeout param to rIC below helps when you are doing
        // a long continuous scroll, it forces it to evaluate because
        // otherwise the continuous scroll would never give it time to do
        // so
        rIC(
          () => {
            if (!isAlive(model)) {
              return
            }
            hydrate(
              <ThemeProvider theme={theme}>
                <RenderErrorBoundary>
                  <RenderingComponent {...data} {...renderProps} />
                </RenderErrorBoundary>
              </ThemeProvider>,
              domNode,
            )
          },
          { timeout: 300 },
        )
      }
    }

    doHydrate()

    return () => {
      if (domNode) {
        unmountComponentAtNode(domNode)
      }
    }
  }, [model, theme])

  return (
    <div
      ref={ssrContainerNode}
      data-html-size={model.html.length}
      className="ssr-container"
    />
  )
}

ServerSideRenderedContent.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ServerSideRenderedContent)
