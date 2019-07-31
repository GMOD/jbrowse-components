export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { isAlive, isStateTreeNode, getSnapshot } = jbrequire('mobx-state-tree')
  const { useEffect, useState, useRef, Fragment } = React
  const { observer } = jbrequire('mobx-react')
  const { unmountComponentAtNode, hydrate } = jbrequire('react-dom')

  const RpcRenderedSvgGroup = observer(({ model }) => {
    const { id, data, html, filled, renderProps, renderingComponent } = model

    const ssrContainerNode = useRef(null)

    useEffect(() => {
      const domNode = ssrContainerNode.current
      if (domNode) {
        if (domNode.firstChild && domNode.firstChild.innerHTML) {
          domNode.style.display = 'none'
          requestIdleCallback(() => unmountComponentAtNode(domNode.firstChild))
        }
        domNode.innerHTML = `<g className="ssr-container-inner"></g>`
        if (filled) {
          domNode.style.display = 'inline'
          domNode.firstChild.innerHTML = html
          // use requestIdleCallback to defer main-thread rendering
          // and hydration for when we have some free time. helps
          // keep the framerate up.
          requestIdleCallback(() => {
            if (!isAlive(model)) return
            const mainThreadRendering = React.createElement(
              renderingComponent,
              {
                ...data,
                ...renderProps,
              },
              null,
            )
            requestIdleCallback(() => {
              if (!isAlive(model)) return
              hydrate(mainThreadRendering, domNode.firstChild)
            })
          })
        }
      }
    })

    return <g ref={ssrContainerNode} />
  })

  return RpcRenderedSvgGroup
}
