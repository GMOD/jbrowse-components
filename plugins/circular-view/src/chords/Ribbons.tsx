import { observer } from 'mobx-react'

import Ribbon from './Ribbon.tsx'

import type { RibbonDisplayModel } from './types.ts'

const Ribbons = observer(function Ribbons({
  display,
}: {
  display: RibbonDisplayModel
}) {
  const {
    drawnFeatures,
    configuration,
    ribbonFill,
    ribbonOpacity,
    sliceFor,
    radiusPx,
    bezierRadius,
    selectedFeatureId,
    highlightedFeatureIdSet,
    onRibbonClick,
  } = display
  return (
    // `cursor` is inherited, so it belongs here rather than repeated on every
    // ribbon — a whole-genome alignment is tens of thousands of them, and each
    // copy is also a dead attribute in the SVG export
    <g
      data-testid="syntenyRibbonRenderer"
      cursor="crosshair"
      fillOpacity={ribbonOpacity}
    >
      {drawnFeatures?.map(feature => (
        <Ribbon
          key={feature.id()}
          feature={feature}
          config={configuration}
          restingFill={ribbonFill}
          radius={radiusPx}
          bezierRadius={bezierRadius}
          sliceFor={sliceFor}
          selected={selectedFeatureId === feature.id()}
          dimmed={highlightedFeatureIdSet?.has(feature.id()) === false}
          onClick={onRibbonClick}
        />
      ))}
    </g>
  )
})

export default Ribbons
