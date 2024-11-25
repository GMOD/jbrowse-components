import React from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region, Feature } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const Arrow = observer(function Arrow({
  feature,
  featureLayout,
  config,
  region,
}: {
  region: Region
  feature: Feature
  featureLayout: SceneGraph
  config: AnyConfigurationModel
}) {
  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = region.reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute

  const c = readConfObject(config, 'color2', { feature })
  const theme = useTheme()
  const color2 = c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null
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
        fill={color2}
      />
    </>
  ) : null
})

export default Arrow
