export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { isAlive } = jbrequire('mobx-state-tree')
  const { useEffect, useRef } = React
  const { observer } = jbrequire('mobx-react-lite')
  const { unmountComponentAtNode, hydrate } = jbrequire('react-dom')

  function RpcRenderedSvgGroup({ model }) {
    const { id, data, html, filled, renderProps, renderingComponent } = model

    const ssrContainerNode = useRef(null)

    useEffect(() => {
      const domNode = ssrContainerNode.current
      if (domNode) {
        if (domNode.firstChild && domNode.firstChild.innerHTML) {
          domNode.style.display = 'none'
          requestIdleCallback(() => unmountComponentAtNode(domNode.firstChild))
        }
        domNode.innerHTML = `<g data-testid="rpc-rendered-circular-chord-track" className="ssr-container-inner"></g>`
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
  }

  return observer(RpcRenderedSvgGroup)
}
