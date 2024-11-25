import React, { useEffect, useRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'

// locals
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
// eslint-disable-next-line react/no-deprecated
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { createJBrowseTheme } from '../../ui'
import { rIC } from '../../util'
import type { ResultsSerialized, RenderArgs } from './ServerSideRendererType'

interface Props extends ResultsSerialized, RenderArgs {
  RenderingComponent: React.ComponentType<any>
}

const NewHydrate = observer(function ServerSideRenderedContent({
  theme,
  html,
  RenderingComponent,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const rootRef = useRef<any>()
  const { hydrateFn } = getRoot<any>(rest.displayModel)

  useEffect(() => {
    // requestIdleCallback here helps to avoid hydration mismatch because it
    // provides time for dangerouslySetInnerHTML to set the innerHTML contents
    // of the node, otherwise ref.current.innerHTML can be empty
    const renderTimeout = rIC(() => {
      if (!ref.current) {
        return
      }
      const jbrowseTheme = createJBrowseTheme(theme)
      // if there is a hydration mismatch, investigate value of
      // - value of ref.current.innerHTML
      // - value of `html` variable
      // - renderToString of the below React element
      rootRef.current =
        rootRef.current ??
        hydrateFn(
          ref.current,
          <ThemeProvider theme={jbrowseTheme}>
            <RenderingComponent {...rest} />
          </ThemeProvider>,
        )
    })
    return () => {
      if (renderTimeout !== undefined) {
        clearTimeout(renderTimeout)
      }
      const root = rootRef.current
      rootRef.current = undefined

      setTimeout(() => {
        root?.unmount()
      })
    }
    /* biome-ignore lint/correctness/useExhaustiveDependencies: */
  }, [theme, rest, hydrateFn, RenderingComponent])

  return (
    <div
      data-testid="hydrationContainer"
      ref={ref}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
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
        unmountComponentAtNode(domNode)
        domNode.innerHTML = html

        rIC(() => {
          hydrate(
            <ThemeProvider theme={jbrowseTheme}>
              <RenderingComponent {...rest} />
            </ThemeProvider>,
            domNode,
          )
        })
      }
    }

    doHydrate()

    return () => {
      if (domNode) {
        unmountComponentAtNode(domNode)
      }
    }
    /* biome-ignore lint/correctness/useExhaustiveDependencies: */
  }, [html, jbrowseTheme, rest, RenderingComponent])

  return <div ref={ref} />
})

const ServerSideRenderedContent = observer(function (props: Props) {
  const root = getRoot<any>(props.displayModel)
  return root.hydrateFn ? <NewHydrate {...props} /> : <OldHydrate {...props} />
})

export default ServerSideRenderedContent
