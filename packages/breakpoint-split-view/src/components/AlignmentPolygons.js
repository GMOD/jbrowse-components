import Path from 'svg-path-generator'

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')

  const [LEFT, TOP, RIGHT, BOTTOM] = [0, 1, 2, 3]

  function calc(view, coord) {
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
              const ret = []
              for (let i = 0; i < chunk.length - 1; i += 1) {
                const { feature: feature1, layout: c1, level: level1 } = chunk[
                  i
                ]
                const { feature: feature2, layout: c2, level: level2 } = chunk[
                  i + 1
                ]
                const f1 = calc(level1 == 0 ? topLGV : bottomLGV, c1[RIGHT])
                const f4 = calc(level2 == 0 ? topLGV : bottomLGV, c2[LEFT])
                const added = level => {
                  return level == 0
                    ? topLGV.headerHeight +
                        topLGV.scaleBarHeight +
                        topLGV.getTrackPos(trackConfigId) +
                        model.headerHeight +
                        3
                    : model.headerHeight +
                        topLGV.height +
                        3 +
                        bottomLGV.headerHeight +
                        bottomLGV.scaleBarHeight +
                        bottomLGV.getTrackPos(trackConfigId) +
                        10 // margin
                }

                const h1 = c1[BOTTOM] + added(level1)
                const h2 = c2[TOP] + added(level2)
                const path = Path()
                  .moveTo(f1, h1 - cheight(c1) / 2)
                  .curveTo(f1 + 200, h1, f4 - 200, h2, f4, h2 + cheight(c2) / 2)
                  .end()
                ret.push(
                  <path
                    d={path}
                    key={JSON.stringify(path)}
                    stroke="black"
                    fill="none"
                  />,
                )
              }
              return ret
            })}
          </svg>
        </div>
      )
    },
  )

  return AlignmentInfo
}
