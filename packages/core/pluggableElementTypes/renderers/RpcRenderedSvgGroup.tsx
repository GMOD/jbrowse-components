import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { AnyReactComponentType, Feature, rIC } from '../../util'

export default observer(function (props: {
  html: string
  features: Map<string, Feature>
  RenderingComponent: AnyReactComponentType
}) {
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
