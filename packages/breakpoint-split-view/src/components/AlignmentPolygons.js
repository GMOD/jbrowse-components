import Path from 'svg-path-generator'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const [LEFT, TOP, RIGHT, BOTTOM] = [0, 1, 2, 3]

  function transform(view, coord) {
    return coord / view.bpPerPx - view.offsetPx
  }
  function cheight(chunk) {
    return chunk[BOTTOM] - chunk[TOP]
  }
  const AlignmentInfo = observer(
    ({ model, alignmentChunks, height, children, trackConfigId }) => {
      const { topLGV, bottomLGV, controlsWidth } = model
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ width: controlsWidth, flexShrink: 0 }} />
          <svg style={{ width: '100%', zIndex: 10000, pointerEvents: 'none' }}>
            {alignmentChunks.map(chunk => {
              const [name, c1, c2] = chunk
              const f1 = transform(topLGV, c1[LEFT])
              const f2 = transform(topLGV, c1[RIGHT])
              const f3 = transform(bottomLGV, c2[LEFT])
              const f4 = transform(bottomLGV, c2[RIGHT])

              const h1 =
                c1[BOTTOM] +
                topLGV.headerHeight +
                topLGV.scaleBarHeight +
                topLGV.getTrackPos(trackConfigId) +
                model.headerHeight +
                3 // margin-top
              const h2 =
                c2[TOP] +
                model.headerHeight +
                topLGV.height +
                3 +
                bottomLGV.headerHeight +
                bottomLGV.scaleBarHeight +
                bottomLGV.getTrackPos(trackConfigId) +
                10 // margin
              const path = Path()
                .moveTo(f1, h1 - cheight(c1) / 2)
                .curveTo(f1 - 200, h1, f4 + 200, h2, f4, h2 + cheight(c2) / 2)
                .end()
              return (
                <path
                  d={path}
                  key={JSON.stringify(chunk)}
                  name={name}
                  stroke="black"
                  fill="none"
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
