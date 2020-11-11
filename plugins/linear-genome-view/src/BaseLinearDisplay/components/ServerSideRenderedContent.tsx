import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { ThemeProvider } from '@material-ui/core/styles'
import { observer, PropTypes } from 'mobx-react'
import { getSnapshot, isAlive, isStateTreeNode } from 'mobx-state-tree'
import React, { useEffect, useRef } from 'react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import type { BlockModel } from '../models/serverSideRenderedBlock'

function ServerSideRenderedContent(props: { model: BlockModel }) {
  const ssrContainerNode = useRef<HTMLDivElement>(null)
  const hydrated = useRef(false)

  const { model } = props
  const session = getSession(model)
  const theme = createJBrowseTheme(getConf(session, 'theme'))

  useEffect(() => {
    const domNode = ssrContainerNode.current
    const isHydrated = hydrated.current
    function doHydrate() {
      const {
        data,
        region,
        html,
        renderProps,
        renderingComponent: RenderingComponent,
      } = model
      if (domNode && model.filled) {
        if (isHydrated && domNode) {
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
        requestIdleCallback(
          () => {
            if (!isAlive(model) || !isAlive(region)) return
            const serializedRegion = isStateTreeNode(region)
              ? getSnapshot(region)
              : region
            hydrate(
              <ThemeProvider theme={theme}>
                <RenderingComponent
                  {...data}
                  regions={[serializedRegion]}
                  {...renderProps}
                />
              </ThemeProvider>,
              domNode,
            )
            hydrated.current = true
          },
          { timeout: 300 },
        )
      }
    }

    doHydrate()

    return () => {
      if (domNode && isHydrated) {
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
  model: PropTypes.observableObject.isRequired,
}

export default observer(ServerSideRenderedContent)
