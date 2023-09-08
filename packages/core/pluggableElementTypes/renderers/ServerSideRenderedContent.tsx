import React, { useEffect, useRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'

// locals
import { createJBrowseTheme } from '../../ui'
import { ResultsSerialized, RenderArgs } from './ServerSideRendererType'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
// eslint-disable-next-line react/no-deprecated
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { rIC } from '../../util'

interface Props extends ResultsSerialized, RenderArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RenderingComponent: React.ComponentType<any>
}

const NewHydrate = observer(function ServerSideRenderedContent({
  theme,
  html,
  RenderingComponent,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootRef = useRef<any>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = getRoot<any>(rest.displayModel)
  const hydrateRoot = root.hydrateFn

  useEffect(() => {
    const renderTimeout = setTimeout(() => {
      if (!ref.current) {
        return
      }
      const jbrowseTheme = createJBrowseTheme(theme)
      rootRef.current =
        rootRef.current ??
        hydrateRoot(
          ref.current,
          <ThemeProvider theme={jbrowseTheme}>
            <RenderingComponent {...rest} />
          </ThemeProvider>,
        )
    })
    return () => {
      clearTimeout(renderTimeout)
      const root = rootRef.current
      rootRef.current = undefined

      setTimeout(() => {
        root?.unmount()
      })
    }
  }, [html, theme, rest, hydrateRoot, RenderingComponent])

  // eslint-disable-next-line react/no-danger
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
})

const OldHydrate = observer(function ({
  theme,
  html,
  RenderingComponent,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const jbrowseTheme = createJBrowseTheme(theme)

  useEffect(() => {
    const domNode = ref.current
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

  return <div ref={ref} />
})

export default observer(function RpcRenderedSvgGroup(props: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = getRoot<any>(props.displayModel)
  return root.hydrateFn ? <NewHydrate {...props} /> : <OldHydrate {...props} />
})
