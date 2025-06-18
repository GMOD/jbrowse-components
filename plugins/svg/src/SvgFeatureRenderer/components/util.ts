import { readConfObject } from '@jbrowse/core/configuration'
import { getFrame } from '@jbrowse/core/util'

import Box from './Box'
import ProcessedTranscript from './ProcessedTranscript'
import Segments from './Segments'
import Subfeatures from './Subfeatures'

import type {
  ExtraGlyphValidator,
  FeatureLayOutArgs,
  Glyph,
  SubfeatureLayOutArgs,
} from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type SceneGraph from '@jbrowse/core/util/layouts/SceneGraph'
import type { Theme } from '@mui/material'

/**
 * Selects the appropriate glyph component to render a feature based on its
 * type and structure
 *
 * This function examines the feature's type and subfeatures to determine the
 * most appropriate visualization component:
 * - ProcessedTranscript: For transcript features with CDS subfeatures
 * - Subfeatures: For container features with nested subfeatures
 * - Segments: For features with simple subfeatures
 * - Box (default): For simple features without subfeatures
 * - Custom glyphs: Based on validator functions
 *
 * @param feature - The genomic feature to render
 * @param extraGlyphs - Optional custom glyph components with validators
 * @param config - Configuration model with display settings
 * @returns The appropriate Glyph component to render the feature
 */
export function chooseGlyphComponent({
  feature,
  extraGlyphs,
  config,
}: {
  feature: Feature
  config: AnyConfigurationModel
  extraGlyphs?: ExtraGlyphValidator[]
}): Glyph {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  const transcriptTypes = readConfObject(config, 'transcriptTypes')
  const containerTypes = readConfObject(config, 'containerTypes')

  if (subfeatures?.length && type !== 'CDS') {
    const hasSubSub = subfeatures.some(f => f.get('subfeatures')?.length)
    const hasCDS = subfeatures.some(f => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return ProcessedTranscript
    } else if (
      (!feature.parent() && hasSubSub) ||
      containerTypes.includes(type)
    ) {
      return Subfeatures
    } else {
      return Segments
    }
  } else {
    return extraGlyphs?.find(f => f.validator(feature))?.glyph || Box
  }
}

/**
 * Main layout function that positions a feature and its subfeatures in the
 * scene graph
 *
 * This function first lays out the main feature, then recursively lays out
 * its subfeatures if the display mode permits showing subfeatures.
 *
 * @param layout - The scene graph to add the feature to
 * @param feature - The feature to lay out
 * @param bpPerPx - Base pairs per pixel (zoom level)
 * @param reversed - Whether the display is reversed
 * @param config - Configuration settings
 * @param extraGlyphs - Optional custom glyphs
 * @returns The updated scene graph with the feature and subfeatures added
 */
export function layOut({
  layout,
  feature,
  bpPerPx,
  reversed,
  config,
  extraGlyphs,
}: FeatureLayOutArgs): SceneGraph {
  const displayMode = readConfObject(config, 'displayMode')
  const subLayout = layOutFeature({
    layout,
    feature,
    bpPerPx,
    reversed,
    config,
    extraGlyphs,
  })
  if (displayMode !== 'reducedRepresentation') {
    layOutSubfeatures({
      layout: subLayout,
      subfeatures: feature.get('subfeatures') || [],
      bpPerPx,
      reversed,
      config,
      extraGlyphs,
    })
  }
  return subLayout
}

/**
 * Positions a single feature in the scene graph
 *
 * This function calculates the position of a feature based on its genomic coordinates,
 * parent feature (if any), and display settings. It then adds the feature to the
 * scene graph with the appropriate glyph component.
 *
 * @param args - Layout arguments including feature and display settings
 * @returns The updated scene graph with the feature added
 */
export function layOutFeature(args: FeatureLayOutArgs) {
  const { layout, feature, bpPerPx, reversed, config, extraGlyphs } = args
  const displayMode = readConfObject(config, 'displayMode') as string
  const GlyphComponent =
    displayMode === 'reducedRepresentation'
      ? Box
      : chooseGlyphComponent({
          feature,
          extraGlyphs,
          config,
        })
  const parentFeature = feature.parent()
  let x = 0
  if (parentFeature) {
    // Calculate x position relative to parent feature
    x =
      (reversed
        ? parentFeature.get('end') - feature.get('end')
        : feature.get('start') - parentFeature.get('start')) / bpPerPx
  }
  const height = readConfObject(config, 'height', { feature }) as number
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const layoutParent = layout.parent
  const top = layoutParent ? layoutParent.top : 0
  return layout.addChild(
    feature.id(),
    x,
    displayMode === 'collapse' ? 0 : top,
    Math.max(width, 1), // has to be at least one to register in the layout
    displayMode === 'compact' ? height / 2 : height,
    { GlyphComponent },
  )
}

/**
 * Lays out multiple subfeatures within a parent feature
 *
 * This function iterates through the subfeatures and lays out each one
 * using either its custom layout function or the default layout function.
 *
 * @param args - Layout arguments including subfeatures array and display settings
 */
export function layOutSubfeatures(args: SubfeatureLayOutArgs) {
  const { layout, subfeatures, bpPerPx, reversed, config, extraGlyphs } = args
  for (const feature of subfeatures) {
    // Use the feature's custom layout function if available, otherwise use the default
    ;(chooseGlyphComponent({ feature, extraGlyphs, config }).layOut || layOut)({
      layout,
      feature,
      bpPerPx,
      reversed,
      config,
      extraGlyphs,
    })
  }
}

/**
 * Determines if a feature is an untranslated region (UTR)
 *
 * This function checks if the feature type contains UTR-related keywords
 * such as "UTR", "_UTR", or "untranslated region".
 *
 * @param feature - The genomic feature to check
 * @returns True if the feature is a UTR, false otherwise
 */
export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}

/**
 * Get the appropriate color for a box feature based on its properties
 * @param feature - The genomic feature
 * @param config - The configuration model
 * @param colorByCDS - Whether to color by CDS frame
 * @param theme - Material UI theme object
 * @returns The color string to use for the feature
 */
export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  colorByCDS: boolean
  theme: Theme
}): string {
  // Get the basic color based on UTR status
  let fill: string = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })

  // If coloring by CDS and this is a CDS feature with strand and phase
  const featureType: string | undefined = feature.get('type')
  const featureStrand: -1 | 1 | undefined = feature.get('strand')
  const featurePhase: 0 | 1 | 2 | undefined = feature.get('phase')

  if (
    colorByCDS &&
    featureType === 'CDS' &&
    featureStrand !== undefined &&
    featurePhase !== undefined
  ) {
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')

    // Calculate the frame and get the corresponding color
    const frame = getFrame(
      featureStart,
      featureEnd,
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }

  return fill
}
