import React from 'react'
import { observer } from 'mobx-react'

import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { SceneGraph } from '@jbrowse/core/util/layouts'

const Arrow = ({
  feature,
  featureLayout,
  config,
}: {
  feature: Feature;
  featureLayout: SceneGraph;
  config: AnyConfigurationModel;
}) => {
  const strand = feature.get('strand')
  const size = 5
  const offset = 7 * strand
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute
  const color2 = readConfObject(config, 'color2', { feature })
  const p = strand === -1 ? left : strand === 1 ? left + width : null
  const y = top + height / 2

  return p ? (
    <>
      <line x1={p} x2={p + offset} y1={y} y2={y} stroke={color2} />
      <polygon
        points={[
          [p + offset / 2, y - size / 2],
          [p + offset / 2, y + size / 2],
          [p + offset, y],
        ].toString()}
        stroke={color2}
      />
    </>
  ) : null
}

export default observer(Arrow)
