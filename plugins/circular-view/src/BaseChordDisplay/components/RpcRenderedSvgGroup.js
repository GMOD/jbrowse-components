export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { isAlive } = jbrequire('mobx-state-tree')
  const { useEffect, useRef } = React
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const { unmountComponentAtNode, hydrate } = jbrequire('react-dom')

  function RpcRenderedSvgGroup({ model }) {
    const { data, html, filled, renderProps, renderingComponent } = model

    const ssrContainerNode = useRef(null)
    const hydrated = useRef(false)

    useEffect(() => {
      const domNode = ssrContainerNode.current
      const isHydrated = hydrated.current
      function doHydrate() {
        if (domNode && filled) {
          if (domNode && domNode.innerHTML && isHydrated) {
            domNode.style.display = 'none'
            requestIdleCallback(() => unmountComponentAtNode(domNode))
          }
          domNode.style.display = 'inline'
          domNode.innerHTML = html
          // use requestIdleCallback to defer main-thread rendering
          // and hydration for when we have some free time. helps
          // keep the framerate up.
          requestIdleCallback(() => {
            if (!isAlive(model)) return
            const mainThreadRendering = React.createElement(
              renderingComponent,
              { ...data, ...renderProps },
              null,
            )
            requestIdleCallback(() => {
              if (!isAlive(model)) return
              hydrate(mainThreadRendering, domNode)
            })
          })
        }
      }
      doHydrate()
    })

    return <g ref={ssrContainerNode} />
  }

  RpcRenderedSvgGroup.propTypes = {
    model: MobxPropTypes.observableObject.isRequired,
  }

  return observer(RpcRenderedSvgGroup)
}
