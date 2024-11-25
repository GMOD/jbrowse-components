import React, { useEffect, useRef } from 'react'

// locals
import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
// eslint-disable-next-line react/no-deprecated
import { hydrate, unmountComponentAtNode } from 'react-dom'
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

const NewHydrate = observer(function RpcRenderedSvgGroup(props: Props) {
  const { html, theme, RenderingComponent, ...rest } = props
  const ref = useRef<SVGGElement>(null)

  // this `any` is a react-dom/client::Root

  const rootRef = useRef<any>()

  const root = getRoot<any>(props.displayModel)
  const hydrateRoot = root.hydrateFn

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
      rootRef.current = undefined

      setTimeout(() => {
        root?.unmount()
      })
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies:
  }, [RenderingComponent, hydrateRoot, theme, rest])

  return <g ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
})

const OldHydrate = observer(function OldHydrate(props: Props) {
  const { html, RenderingComponent } = props
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const domNode = ref.current
    function doHydrate() {
      if (domNode && html) {
        if (domNode.innerHTML) {
          unmountComponentAtNode(domNode)
        }

        // setting outline:none fixes react "focusable" element issue. see
        // https://github.com/GMOD/jbrowse-components/issues/2160
        domNode.style.outline = 'none'
        domNode.innerHTML = html
        // use requestIdleCallback to defer main-thread rendering and
        // hydration for when we have some free time. helps keep the
        // framerate up.
        rIC(() => {
          hydrate(<RenderingComponent {...props} />, domNode)
        })
      }
    }
    doHydrate()
    return () => {
      if (domNode) {
        unmountComponentAtNode(domNode)
      }
    }
  }, [html, RenderingComponent, props])

  return <g ref={ref} />
})

const RpcRenderedSvgGroup = observer(function (props: Props) {
  const root = getRoot<any>(props.displayModel)
  return root.hydrateFn ? <NewHydrate {...props} /> : <OldHydrate {...props} />
})

export default RpcRenderedSvgGroup
