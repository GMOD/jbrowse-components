/* eslint-disable import/no-cycle */
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import SceneGraph from '@gmod/jbrowse-core/util/layouts/SceneGraph'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import Box from './Box'
import Chevron from './Chevron'
import ProcessedTranscript from './ProcessedTranscript'
import Segments from './Segments'
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
    const type = feature.get('type')
    if (['mRNA', 'transcript'].includes(type)) return ProcessedTranscript
    return Segments
  }
  const strand = feature.get('strand')
  if ([1, -1, '+', '-'].includes(strand)) return Chevron
  return Box
}

interface BaseLayOutArgs {
  layout: SceneGraph
  region: IRegion
  bpPerPx: number
  horizontallyFlipped: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any
}

interface FeatureLayOutArgs extends BaseLayOutArgs {
  feature: Feature
}

interface SubfeatureLayOutArgs extends BaseLayOutArgs {
  subfeatures: Feature[]
}

export function layOut(args: FeatureLayOutArgs): SceneGraph {
  const { layout, feature, region, bpPerPx, horizontallyFlipped, config } = args
  const subLayout = layOutFeatures({
    layout,
    feature,
    region,
    bpPerPx,
    horizontallyFlipped,
    config,
  })
  layOutSubfeatures({
    layout: subLayout,
    subfeatures: feature.get('subfeatures') || [],
    region,
    bpPerPx,
    horizontallyFlipped,
    config,
  })
  return subLayout
}

export function layOutFeatures(args: FeatureLayOutArgs): SceneGraph {
  const { layout, feature, bpPerPx, config } = args
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
  return subLayout
}

export function layOutSubfeatures(args: SubfeatureLayOutArgs): void {
  const {
    layout: subLayout,
    subfeatures,
    region,
    bpPerPx,
    horizontallyFlipped,
    config,
  } = args
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
}

export function isUTR(feature: Feature): boolean {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
    feature.get('type') || '',
  )
}
