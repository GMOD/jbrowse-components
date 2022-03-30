import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { Region } from '@jbrowse/core/util/types'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { observer } from 'mobx-react'
import { isUTR } from './util'
import Arrow from './Arrow'
import { SceneGraph } from '@jbrowse/core/util/layouts'

const utrHeightFraction = 0.65

function Box(props: {
  feature: Feature;
  region: Region;
  config: AnyConfigurationModel;
  featureLayout: SceneGraph;
  bpPerPx: number;
  selected?: boolean;
  topLevel?: boolean;
  children?: React.ReactNode;
}) {
  const { feature, region, config, featureLayout, bpPerPx, topLevel } = props
  const { start, end } = region
  const screenWidth = (end - start) / bpPerPx
  const { left = 0, width = 0 } = featureLayout.absolute
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
  const widthWithinBlock = Math.max(1, Math.min(width - diff, screenWidth))

  // if feature has parent and type is intron, then don't render the intron
  // subfeature (if it doesn't have a parent, then maybe the introns are
  // separately displayed features that should be displayed)
  return feature.parent() && feature.get('type') === 'intron' ? null : (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={
          isUTR(feature)
            ? readConfObject(config, 'color3', { feature })
            : readConfObject(config, 'color1', { feature })
        }
        stroke={readConfObject(config, 'outline', { feature }) as string}
      />
    </>
  )
}

export default observer(Box)
