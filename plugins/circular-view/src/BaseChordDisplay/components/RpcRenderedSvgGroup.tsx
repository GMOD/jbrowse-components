import React, { useEffect, useRef } from 'react'
import { isAlive } from 'mobx-state-tree'
import { observer } from 'mobx-react'
import { hydrate, unmountComponentAtNode } from 'react-dom'
import { rIC } from '@jbrowse/core/util'

function RpcRenderedSvgGroup({
  model,
}: {
  model: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
    html: string
    filled: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderingComponent: React.FC<any>
    renderProps: Function
  }
}) {
  const { data, html, filled, renderingComponent } = model

  const ssrContainerNode = useRef<SVGGElement>(null)

  useEffect(() => {
    const domNode = ssrContainerNode.current
    function doHydrate() {
      if (domNode && filled) {
        if (domNode.innerHTML) {
          domNode.style.display = 'none'
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
          if (!isAlive(model)) {
            return
          }
          const mainThreadRendering = React.createElement(
            renderingComponent,
            { ...data, ...model.renderProps() },
            null,
          )
          rIC(() => {
            if (!isAlive(model)) {
              return
            }
            hydrate(mainThreadRendering, domNode)
          })
        })
      }
    }
    doHydrate()
    return () => {
      if (domNode) {
        unmountComponentAtNode(domNode)
      }
    }
  })

  return <g ref={ssrContainerNode} />
}

export default observer(RpcRenderedSvgGroup)
