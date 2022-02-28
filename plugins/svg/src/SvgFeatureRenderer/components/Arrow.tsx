import React from 'react'
import { observer } from 'mobx-react'

import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util/simpleFeature'

const Arrow = ({
  feature,
  featureLayout,
  config,
}: {
  feature: Feature
  featureLayout: any
  config: AnyConfigurationModel
}) => {
  const strand = feature.get('strand')
  const arrowSize = 3
  const arrowOffset = 7
  const { left, top, width, height } = featureLayout.absolute
  const color2 = readConfObject(config, 'color2', { feature })
  const r = left + width
  const l = left
  const y = top + height / 2

  return strand === 1 ? (
    <>
      <line x1={r} x2={r + arrowOffset} y1={y} y2={y} stroke={color2} />
      <polygon
        points={[
          [r + arrowOffset / 2, y - arrowSize / 2],
          [r + arrowOffset / 2, y + arrowSize / 2],
          [r + arrowOffset, y],
        ].toString()}
        stroke={color2}
      />
    </>
  ) : strand === -1 ? (
    <>
      <line x1={l} x2={l - arrowOffset} y1={y} y2={y} stroke={color2} />
      <polygon
        points={[
          [l - arrowOffset / 2, y - arrowSize / 2],
          [l - arrowOffset / 2, y + arrowSize / 2],
          [l - arrowOffset, y],
        ].toString()}
        stroke={color2}
      />
    </>
  ) : null
}

export default observer(Arrow)
