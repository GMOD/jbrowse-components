import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import Box from './Box'
import Chevron from './Chevron'
import Segments from './Segments'
// eslint-disable-next-line import/no-cycle
import Subfeatures from './Subfeatures'

interface Glyph extends React.FunctionComponent {
  layOut?: Function
}

export function chooseGlyphComponent(feature: Feature): Glyph {
  const subfeatures = feature.get('subfeatures')
  let hasSubSub = false
  if (subfeatures) {
    subfeatures.forEach((subfeature: Feature) => {
      if (subfeature.get('subfeatures')) hasSubSub = true
    })
    if (hasSubSub) return Subfeatures
    return Segments
  }
  const strand = feature.get('strand')
  if ([1, -1, '+', '-'].includes(strand)) return Chevron
  return Box
}

export function layOut(args: {
  layout: SceneGraph
  feature: Feature
  region: IRegion
  bpPerPx: number
  horizontallyFlipped: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
}): SceneGraph {
  const { layout, feature, region, bpPerPx, horizontallyFlipped, config } = args
  const GlyphComponent = chooseGlyphComponent(feature)
  const parentFeature = feature.parent()
  const x = parentFeature
    ? (feature.get('start') - parentFeature.get('start')) / bpPerPx
    : 0
  const height = readConfObject(config, 'height', [feature])
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const layoutParent = layout.parent
  const top = layoutParent ? layoutParent.top : 0
  const subLayout = layout.addChild(
    String(feature.id()),
    x,
    top,
    width,
    height,
    { GlyphComponent },
  )

  const subfeatures = feature.get('subfeatures') || []
  subfeatures.forEach((subfeature: Feature) => {
    const SubfeatureGlyphComponent = chooseGlyphComponent(subfeature)
    ;(SubfeatureGlyphComponent.layOut || layOut)({
      layout: subLayout,
      feature: subfeature,
      region,
      bpPerPx,
      horizontallyFlipped,
      config,
    })
  })
  return subLayout
}
