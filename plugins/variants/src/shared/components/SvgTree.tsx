import { observer } from 'mobx-react'

import type { LegendBarModel } from './types'

const SvgTree = observer(function ({ model }: { model: LegendBarModel }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { treeAreaWidth: _treeAreaWidth, hierarchy } = model
  const svg = []
  let idx = 0
  if (hierarchy) {
    for (const link of hierarchy.links()) {
      const { source, target } = link
      const sy = source.x!
      const ty = target.x!
      const tx = target.y!
      const sx = source.y!

      // Vertical line
      svg.push(
        <line
          key={`${sx}-${sy}-${tx}-${ty}-${idx++}`}
          x1={sx}
          y1={sy}
          x2={sx}
          y2={ty}
          stroke="black"
          opacity="0.4"
        />,
        <line
          key={`${sx}-${sy}-${tx}-${ty}-${idx++}`}
          x1={sx}
          y1={ty}
          x2={tx}
          y2={ty}
          stroke="black"
          opacity="0.4"
        />,
      )
    }
  }
  return svg
})

export default SvgTree
