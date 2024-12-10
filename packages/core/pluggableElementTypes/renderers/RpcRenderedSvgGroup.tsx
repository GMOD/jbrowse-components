import { useEffect, useRef } from 'react'

import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'
import { type Root, hydrateRoot } from 'react-dom/client'

// locals
import { createJBrowseTheme } from '../../ui'
import { rIC } from '../../util'

import type { AnyReactComponentType, Feature } from '../../util'
import type { ThemeOptions } from '@mui/material'

interface Props {
  html: string
  features: Map<string, Feature>
  theme: ThemeOptions

  displayModel?: any
  RenderingComponent: AnyReactComponentType
}

const RpcRenderedSvgGroup = observer(function RpcRenderedSvgGroup(
  props: Props,
) {
  const { html, theme, RenderingComponent, ...rest } = props
  const ref = useRef<SVGGElement>(null)
  const rootRef = useRef<Root>(null)

  useEffect(() => {
    const renderTimeout = rIC(() => {
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
      if (renderTimeout !== undefined) {
        clearTimeout(renderTimeout)
      }
      const root = rootRef.current
      rootRef.current = null

      setTimeout(() => {
        root?.unmount()
      })
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies:
  }, [RenderingComponent, theme, rest])

  return <g ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
})

export default RpcRenderedSvgGroup
