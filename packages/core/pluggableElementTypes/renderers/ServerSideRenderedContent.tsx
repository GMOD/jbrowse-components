import React, { useEffect, useRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { hydrateRoot, Root } from 'react-dom/client'

// locals
import { createJBrowseTheme } from '../../ui'
import { ResultsSerialized, RenderArgs } from './ServerSideRendererType'

interface Props extends ResultsSerialized, RenderArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RenderingComponent: React.ComponentType<any>
}

export default function ServerSideRenderedContent({
  theme,
  html,
  RenderingComponent,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const rootRef = useRef<Root>()

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
  }, [html, theme, rest, RenderingComponent])

  // eslint-disable-next-line react/no-danger
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
