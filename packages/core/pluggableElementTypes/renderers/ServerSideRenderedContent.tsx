import React, { useEffect, useRef } from 'react'

import { ThemeProvider } from '@mui/material/styles'
import { observer } from 'mobx-react'
import { type Root, hydrateRoot } from 'react-dom/client'

import { createJBrowseTheme } from '../../ui'
import { rIC } from '../../util'

import type { RenderArgs, ResultsSerialized } from './ServerSideRendererType'

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
  const rootRef = useRef<Root>(null)

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
        hydrateRoot(
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
      rootRef.current = null

      setTimeout(() => {
        root?.unmount()
      })
    }
    /* biome-ignore lint/correctness/useExhaustiveDependencies: */
  }, [theme, rest, RenderingComponent])

  return (
    <div
      data-testid="hydrationContainer"
      ref={ref}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

const ServerSideRenderedContent = observer(function (props: Props) {
  return <NewHydrate {...props} />
})

export default ServerSideRenderedContent
