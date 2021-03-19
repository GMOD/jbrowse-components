import { readConfObject } from '@jbrowse/core/configuration'
import SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import Box from './Box'
import Chevron from './Chevron'
import ProcessedTranscript from './ProcessedTranscript'
import Segments from './Segments'
import Subfeatures from './Subfeatures'

interface Glyph extends React.FunctionComponent {
  layOut?: Function
}

export function chooseGlyphComponent(feature: Feature): Glyph {
  const type = feature.get('type')
  const strand = feature.get('strand')
  const subfeatures: Feature[] = feature.get('subfeatures')

  if (subfeatures) {
    const hasSubSub = subfeatures.find(subfeature => {
      return !!subfeature.get('subfeatures')
    })
    if (hasSubSub) {
      return Subfeatures
    }
    const transcriptTypes = ['mRNA', 'transcript']
    if (
      transcriptTypes.includes(type) &&
      subfeatures.find(f => f.get('type') === 'CDS')
    ) {
      return ProcessedTranscript
    }
    return Segments
  }
  return [1, -1].includes(strand) ? Chevron : Box
}

interface BaseLayOutArgs {
  layout: SceneGraph
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
}

interface FeatureLayOutArgs extends BaseLayOutArgs {
  feature: Feature
}

interface SubfeatureLayOutArgs extends BaseLayOutArgs {
  subfeatures: Feature[]
}

export function layOut({
  layout,
  feature,
  bpPerPx,
  reversed,
  config,
}: FeatureLayOutArgs): SceneGraph {
  const displayMode = readConfObject(config, 'displayMode')
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
  })
  if (displayMode !== 'reducedRepresentation') {
    layOutSubfeatures({
      layout: subLayout,
      subfeatures: feature.get('subfeatures') || [],
      bpPerPx,
      reversed,
      config,
    })
  }
  return subLayout
}

export function layOutFeature(args: FeatureLayOutArgs): SceneGraph {
  const { layout, feature, bpPerPx, reversed, config } = args
  const displayMode = readConfObject(config, 'displayMode')
  const GlyphComponent =
    displayMode === 'reducedRepresentation'
      ? Chevron
      : chooseGlyphComponent(feature)
  const parentFeature = feature.parent()
  let x = 0
  if (parentFeature) {
    x = reversed
      ? (parentFeature.get('end') - feature.get('end')) / bpPerPx
      : (feature.get('start') - parentFeature.get('start')) / bpPerPx
  }
  const height = readConfObject(config, 'height', { feature })
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const layoutParent = layout.parent
  const top = layoutParent ? layoutParent.top : 0
  const subLayout = layout.addChild(
    String(feature.id()),
    x,
    displayMode === 'collapse' ? 0 : top,
    width,
    displayMode === 'compact' ? height / 2 : height,
    { GlyphComponent },
  )
  return subLayout
}

export function layOutSubfeatures(args: SubfeatureLayOutArgs): void {
  const { layout: subLayout, subfeatures, bpPerPx, reversed, config } = args
  subfeatures.forEach(subfeature => {
    const SubfeatureGlyphComponent = chooseGlyphComponent(subfeature)
    ;(SubfeatureGlyphComponent.layOut || layOut)({
      layout: subLayout,
      feature: subfeature,
      bpPerPx,
      reversed,
      config,
    })
  })
}

export function isUTR(feature: Feature): boolean {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
    feature.get('type') || '',
  )
}
