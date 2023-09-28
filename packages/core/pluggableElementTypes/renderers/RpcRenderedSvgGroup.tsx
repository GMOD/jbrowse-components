import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'

// locals
import { AnyReactComponentType, Feature, rIC } from '../../util'
import { ThemeOptions, ThemeProvider } from '@mui/material'
import { createJBrowseTheme } from '../../ui'
import { getRoot } from 'mobx-state-tree'
// eslint-disable-next-line react/no-deprecated
import { hydrate, unmountComponentAtNode } from 'react-dom'

interface Props {
  html: string
  features: Map<string, Feature>
  theme: ThemeOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  displayModel: any
  RenderingComponent: AnyReactComponentType
}

const NewHydrate = observer(function RpcRenderedSvgGroup(props: Props) {
  const { html, theme, RenderingComponent, ...rest } = props
  const ref = useRef<SVGGElement>(null)

  // this `any` is a react-dom/client::Root
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootRef = useRef<any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      clearTimeout(renderTimeout)
      const root = rootRef.current
      rootRef.current = undefined

      setTimeout(() => {
        root?.unmount()
      })
    }
  }, [html, RenderingComponent, hydrateRoot, theme, props, rest])

  // eslint-disable-next-line react/no-danger
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
        // use requestIdleCallback to defer main-thread rendering
        // and hydration for when we have some free time. helps
        // keep the framerate up.
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = getRoot<any>(props.displayModel)
  return root.hydrateFn ? <NewHydrate {...props} /> : <OldHydrate {...props} />
})

export default RpcRenderedSvgGroup
