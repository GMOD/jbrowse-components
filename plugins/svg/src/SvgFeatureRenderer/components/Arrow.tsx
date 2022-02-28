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
  const arrowOffset = 10
  const { left, top, width, height } = featureLayout.absolute
  console.log({ width })
  const color2 = readConfObject(config, 'color2', { feature })
  return null

  // strand ? (
  //   <polyline
  //     points={[
  //       [left + width + arrowOffset / 2, top + height / 2 + arrowSize / 2],
  //       [left + width + arrowOffset, top + height / 2],
  //     ].toString()}
  //     stroke={color2}
  //   />
  // ) : null
}

export default observer(Arrow)
