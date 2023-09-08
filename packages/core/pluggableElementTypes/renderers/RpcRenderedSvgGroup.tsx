import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { Root, hydrateRoot } from 'react-dom/client'

// locals
import { AnyReactComponentType, Feature } from '../../util'
import { ThemeOptions, ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '../../ui'

export default observer(function RpcRenderedSvgGroup(props: {
  html: string
  features: Map<string, Feature>
  theme: ThemeOptions
  RenderingComponent: AnyReactComponentType
}) {
  const { html, theme, RenderingComponent, ...rest } = props
  const ref = useRef<SVGGElement>(null)
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
  }, [html, RenderingComponent, theme, props, rest])

  // eslint-disable-next-line react/no-danger
  return <g ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
})
