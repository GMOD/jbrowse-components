import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { AnyReactComponentType, Feature } from '../../util'

export default observer(function (props: {
  html: string
  features: Map<string, Feature>
  RenderingComponent: AnyReactComponentType
}) {
  const { html, RenderingComponent } = props
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const domNode = ref.current
    if (!domNode) {
      return
    }
    if (domNode.innerHTML) {
      unmountComponentAtNode(domNode)
    }
    // setting outline:none fixes react "focusable" element issue. see
    // https://github.com/GMOD/jbrowse-components/issues/2160
    domNode.style.outline = 'none'
    // use requestIdleCallback to defer main-thread rendering
    // and hydration for when we have some free time. helps
    // keep the framerate up.
    hydrate(<RenderingComponent {...props} />, domNode)

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
  }, [html, RenderingComponent, props])

  // eslint-disable-next-line react/no-danger
  return <g ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
})
