export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const [LEFT, TOP, RIGHT, BOTTOM] = [0, 1, 2, 3]

  function transform(view, coord) {
    return coord / view.bpPerPx - view.offsetPx
  }
  const AlignmentInfo = observer(
    ({ model, alignmentChunks, height, children }) => {
      const { topLGV, bottomLGV } = model
      return (
        <div style={{ position: 'relative' }}>
          {children}
          <svg
            height="100%"
            width="100%" // if 100% this goes causes overflowX to scroll
            style={{
              position: 'absolute',
              top: 0,
              left: 120,
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            {Object.values(alignmentChunks).map(chunk => {
              const [c1, c2] = chunk
              const f1 = transform(topLGV, c1[LEFT])
              const f2 = transform(topLGV, c1[RIGHT])
              const f3 = transform(bottomLGV, c2[LEFT])
              const f4 = transform(bottomLGV, c2[RIGHT])

              const h1 =
                c1[BOTTOM] +
                topLGV.headerHeight +
                topLGV.scaleBarHeight +
                model.headerHeight
              const h2 =
                c2[TOP] +
                topLGV.height +
                bottomLGV.headerHeight +
                bottomLGV.scaleBarHeight +
                model.headerHeight
              return (
                <polygon
                  key={JSON.stringify(chunk)}
                  points={`${f1},${h1} ${f2},${h1} ${f4},${h2} ${f3},${h2} `}
                  style={{
                    fill: 'rgba(255,0,0,0.5)',
                  }}
                />
              )
            })}
          </svg>
        </div>
      )
    },
  )

  return AlignmentInfo
}
