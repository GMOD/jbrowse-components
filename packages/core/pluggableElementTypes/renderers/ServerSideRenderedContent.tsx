import React, { useEffect, useRef } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import { hydrate, unmountComponentAtNode } from 'react-dom'

// locals
import { createJBrowseTheme } from '../../ui'
import { ResultsSerialized, RenderArgs } from './ServerSideRendererType'

interface Props extends ResultsSerialized, RenderArgs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RenderingComponent: React.ComponentType<any>
}

export default function ({ theme, html, RenderingComponent, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const domNode = ref.current

    if (!domNode) {
      return
    }
    if (domNode.innerHTML) {
      unmountComponentAtNode(domNode)
    }

    const jbrowseTheme = createJBrowseTheme(theme)
    hydrate(
      <ThemeProvider theme={jbrowseTheme}>
        <RenderingComponent {...rest} />
      </ThemeProvider>,
      domNode,
    )
    return () => {
      if (domNode) {
        // use setTimeout to try to avoid error :unmounted component rendered
        // by another copy of react error, even when that is not the case. See
        // https://github.com/facebook/react/issues/22343#issuecomment-924098716
        // and specifically that comment

        setTimeout(() => {
          unmountComponentAtNode(domNode)
        }, 0)
      }
    }
  }, [theme, rest, RenderingComponent])

  // eslint-disable-next-line react/no-danger
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
}
