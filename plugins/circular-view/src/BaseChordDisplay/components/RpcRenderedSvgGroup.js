export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { isAlive } = jbrequire('mobx-state-tree')
  const { useEffect, useRef } = React
  const { observer, PropTypes: MobxPropTypes } = jbrequire('mobx-react')
  const { unmountComponentAtNode, hydrate } = jbrequire('react-dom')
  const { rIC } = jbrequire('@jbrowse/core/util')

  function RpcRenderedSvgGroup({ model }) {
    const { data, html, filled, renderProps, renderingComponent } = model

    const ssrContainerNode = useRef(null)

    useEffect(() => {
      const domNode = ssrContainerNode.current
      function doHydrate() {
        if (domNode && filled) {
          if (domNode && domNode.innerHTML) {
            domNode.style.display = 'none'
            unmountComponentAtNode(domNode)
          }
          domNode.style.display = 'inline'
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
              { ...data, ...renderProps },
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

  RpcRenderedSvgGroup.propTypes = {
    model: MobxPropTypes.observableObject.isRequired,
  }

  return observer(RpcRenderedSvgGroup)
}
