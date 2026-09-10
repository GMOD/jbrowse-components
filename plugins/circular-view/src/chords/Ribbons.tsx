import { observer } from 'mobx-react'

import Ribbon from './Ribbon.tsx'

import type { RibbonDisplayModel } from './types.ts'

const Ribbons = observer(function Ribbons({
  display,
}: {
  display: RibbonDisplayModel
}) {
  const {
    features,
    configuration,
    sliceFor,
    radiusPx,
    bezierRadius,
    selectedFeatureId,
    onRibbonClick,
  } = display
  return (
    // `cursor` is inherited, so it belongs here rather than repeated on every
    // ribbon — a whole-genome alignment is tens of thousands of them, and each
    // copy is also a dead attribute in the SVG export
    <g data-testid="syntenyRibbonRenderer" cursor="crosshair">
      {features?.map(feature => (
        <Ribbon
          key={feature.id()}
          feature={feature}
          config={configuration}
          radius={radiusPx}
          bezierRadius={bezierRadius}
          sliceFor={sliceFor}
          selected={selectedFeatureId === feature.id()}
          onClick={onRibbonClick}
        />
      ))}
    </g>
  )
})

export default Ribbons
