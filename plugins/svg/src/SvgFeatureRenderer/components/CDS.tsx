import { readConfObject } from '@jbrowse/core/configuration'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { getBoxColor } from './getBoxColor'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const CDS = observer(function CDS(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  colorByCDS: boolean
}) {
  const theme = useTheme()
  const {
    colorByCDS,
    feature,
    region,
    config,
    featureLayout,
    bpPerPx,
    topLevel,
  } = props
  const { start, end } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const featureType: string | undefined = feature.get('type')
  const width = (featureEnd - featureStart) / bpPerPx
  const { left = 0, top = 0, height = 0 } = featureLayout.absolute

  if (left + width < 0) {
    return null
  }

  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))

  // if feature has parent and type is intron, then don't render the intron
  // subfeature (if it doesn't have a parent, then maybe the introns are
  // separately displayed features that should be displayed)
  return feature.parent() && featureType === 'intron' ? null : (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={getBoxColor({
          feature,
          config,
          colorByCDS,
          theme,
        })}
        stroke={readConfObject(config, 'outline', { feature }) as string}
      />
    </>
  )
})

export default CDS
