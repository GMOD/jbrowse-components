import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { hydrateRoot } from 'react-dom/client'

// locals
import { AnyReactComponentType, Feature, rIC } from '../../util'

export default observer(function RpcRenderedSvgGroup(props: {
  html: string
  features: Map<string, Feature>
  RenderingComponent: AnyReactComponentType
}) {
  const { html, RenderingComponent } = props
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const domNode = ref.current
    if (domNode && html) {
      // setting outline:none fixes react "focusable" element issue. see
      // https://github.com/GMOD/jbrowse-components/issues/2160
      domNode.style.outline = 'none'
      domNode.innerHTML = html

      // use requestIdleCallback to defer main-thread rendering
      // and hydration for when we have some free time. helps
      // keep the framerate up.
      rIC(() => hydrateRoot(domNode, <RenderingComponent {...props} />), {
        timeout: 300,
      })
    }
  }, [html, RenderingComponent, props])

  return <g ref={ref} />
})
