import { readConfObject } from '@jbrowse/core/configuration'
import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { normalizeColor } from './util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
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
  const theme = useTheme()
  const strand = feature.get('strand')
  const reverseFlip = region.reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const { left = 0, top = 0, width = 0, height = 0 } = featureLayout.absolute
  const color2 = normalizeColor(
    readConfObject(config, 'color2', { feature }),
    stripAlpha(theme.palette.text.secondary),
  )
  const size = 5
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null
  const y = top + height / 2

  if (!p) {
    return null
  }

  return (
    <>
      <line x1={p} x2={p + offset} y1={y} y2={y} stroke={color2} />
      <polygon
        points={`${p + offset / 2},${y - size / 2} ${p + offset / 2},${y + size / 2} ${p + offset},${y}`}
        stroke={color2}
        fill={color2}
      />
    </>
  )
})

export default Arrow
