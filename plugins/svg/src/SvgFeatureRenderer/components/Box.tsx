import React from 'react'
import { observer } from 'mobx-react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Region, Feature } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'

// locals
import { isUTR } from './util'
import Arrow from './Arrow'

const utrHeightFraction = 0.65

const Box = observer(function Box(props: {
  feature: Feature
  region: Region
  parentRegion: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  children?: React.ReactNode
}) {
  const {
    feature,
    region,
    parentRegion,
    config,
    featureLayout,
    bpPerPx,
    topLevel,
  } = props
  const { start, end } = region
  const screenWidth = (end - start) / bpPerPx
  const s = feature.get('start')
  const e = feature.get('end')
  const t = feature.get('type')
  const strand = feature.get('strand')
  const phase = feature.get('phase')
  const len = e - s
  const width = len / bpPerPx
  const { left = 0 } = featureLayout.absolute
  let { top = 0, height = 0 } = featureLayout.absolute

  if (left + width < 0) {
    return null
  }

  if (isUTR(feature)) {
    top += ((1 - utrHeightFraction) / 2) * height
    height *= utrHeightFraction
  }
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))

  const colors = ['#FF8080', '#80FF80', '#8080FF']
  let c = 'goldenrod'
  if (t === 'CDS') {
    const frame = (strand === -1 ? parentRegion.end - e + phase : s + phase) % 3
    c = colors[frame]
  }
  const stroke = readConfObject(config, 'outline', { feature }) as string
  const id = `box-${feature.id()}`

  // if feature has parent and type is intron, then don't render the intron
  // subfeature (if it doesn't have a parent, then maybe the introns are
  // separately displayed features that should be displayed)
  return feature.parent() && t === 'intron' ? null : (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={id}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={c}
        stroke={stroke}
      />
    </>
  )
})

export default Box
