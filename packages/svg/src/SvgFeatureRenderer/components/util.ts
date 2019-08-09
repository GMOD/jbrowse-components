import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import Box from './Box'
import Chevron from './Chevron'

export function chooseGlyphComponent(
  feature: Feature,
): React.FunctionComponent {
  const strand = feature.get('strand')
  if ([1, -1, '+', '-'].includes(strand)) return Chevron
  return Box
}

export function layOut(args: {
  feature: Feature
  region: IRegion
  bpPerPx: number
  horizontallyFlipped: boolean
  featureHeight: number
}): SceneGraph {
  const { feature, region, bpPerPx, horizontallyFlipped, featureHeight } = args
  const [startPx, endPx] = featureSpanPx(
    feature,
    region,
    bpPerPx,
    horizontallyFlipped,
  )
  const rootLayout = new SceneGraph('root', startPx, 0, 0, 0)
  const featureWidth = endPx - startPx
  rootLayout.addChild('feature', 0, 0, featureWidth, featureHeight)
  return rootLayout
}
