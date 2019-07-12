export default ({ jbrequire }) => {
  const React = jbrequire('react')
  const { isAlive, isStateTreeNode, getSnapshot } = jbrequire('mobx-state-tree')
  const { useEffect, useState, useRef, Fragment } = React
  const { observer } = jbrequire('mobx-react')

  const { unmountComponentAtNode, hydrate } = jbrequire('react-dom')

  const RpcRenderedContent = observer(({ model }) => {
    const { data, html, renderProps, renderingComponent } = model

    const ssrContainerNode = useRef(null)

    useEffect(() => {
      const domNode = ssrContainerNode.current
      if (domNode && model.filled) {
        if (domNode.firstChild && domNode.firstChild.innerHTML)
          unmountComponentAtNode(domNode.firstChild)
        domNode.innerHTML = `<g className="ssr-container-inner"></g>`
        domNode.firstChild.innerHTML = html
        // defer main-thread rendering and hydration for when
        // we have some free time. helps keep the framerate up.
        requestIdleCallback(() => {
          if (!isAlive(model)) return
          // const serializedRegion = isStateTreeNode(region)
          //   ? getSnapshot(region)
          //   : region
          const mainThreadRendering = React.createElement(
            renderingComponent,
            {
              ...data,
              // region: serializedRegion,
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
    })

    return <g ref={ssrContainerNode} />
  })

  function StructuralVariantChordTrack({ track, view }) {
    // return <g dangerouslySetInnerHTML={{ __html: track.html }} />
    return <RpcRenderedContent model={track} />
  }
  return observer(StructuralVariantChordTrack)
}
