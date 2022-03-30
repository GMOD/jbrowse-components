import { ThemeProvider } from '@material-ui/core/styles'
import React, { useEffect, useRef } from 'react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { createJBrowseTheme } from '../../ui'
import { rIC } from '../../util'
import { ResultsSerialized, RenderArgs } from './ServerSideRendererType'

interface ServerSideRenderedContentProps extends ResultsSerialized, RenderArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RenderingComponent: React.ComponentType<any>;
}

export default function ServerSideRenderedContent(
  props: ServerSideRenderedContentProps,
) {
  const ssrContainerNode = useRef<HTMLDivElement>(null)

  const { theme, html, RenderingComponent, ...rest } = props

  const jbrowseTheme = createJBrowseTheme(theme)

  useEffect(() => {
    const domNode = ssrContainerNode.current
    function doHydrate() {
      if (domNode) {
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
            hydrate(
              <ThemeProvider theme={jbrowseTheme}>
                <RenderingComponent {...rest} />
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
  }, [html, jbrowseTheme, rest, RenderingComponent])

  return (
    <div
      ref={ssrContainerNode}
      data-html-size={html.length}
      className="ssr-container"
    />
  )
}
