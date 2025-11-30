import { readConfObject } from '@jbrowse/core/configuration'
import { calculateLayoutBounds, measureText } from '@jbrowse/core/util'
import { SceneGraph } from '@jbrowse/core/util/layouts'

import Box from './Box'
import CDS from './CDS'
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
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

interface FloatingLabelData {
  text: string
  relativeY: number
  color: string
}

const MAX_LABEL_LENGTH = 50

function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function normalizeColor(color: string, fallback = 'black') {
  return color === '#f0f' ? fallback : color
}

function createFeatureFloatingLabels({
  name,
  description,
  showLabels,
  showDescriptions,
  fontHeight,
  nameColor,
  descriptionColor,
}: {
  name: string
  description: string
  showLabels: boolean
  showDescriptions: boolean
  fontHeight: number
  nameColor: string
  descriptionColor: string
}): FloatingLabelData[] {
  const floatingLabels: FloatingLabelData[] = []
  const truncatedName = truncateLabel(name)
  const truncatedDesc = truncateLabel(description)
  const shouldShowName = showLabels && /\S/.test(truncatedName)
  const shouldShowDesc = showDescriptions && /\S/.test(truncatedDesc)

  if (shouldShowName) {
    floatingLabels.push({
      text: truncatedName,
      relativeY: 0,
      color: normalizeColor(nameColor),
    })
  }
  if (shouldShowDesc) {
    floatingLabels.push({
      text: truncatedDesc,
      relativeY: shouldShowName ? fontHeight : 0,
      color: normalizeColor(descriptionColor),
    })
  }

  return floatingLabels
}

const xPadding = 3
const yPadding = 5

export { xPadding, yPadding }

export interface LabelLayoutResult {
  name: string
  description: string
  shouldShowName: boolean
  shouldShowDescription: boolean
  fontHeight: number
  expansion: number
  floatingLabels?: FloatingLabelData[]
}

export function computeLabelLayout({
  feature,
  config,
  rootLayout,
  featureLayout,
  displayMode,
  includeFloatingLabels = false,
}: {
  feature: Feature
  config: AnyConfigurationModel
  rootLayout: SceneGraph
  featureLayout: SceneGraph
  displayMode: string
  includeFloatingLabels?: boolean
}): LabelLayoutResult {
  const labelAllowed = displayMode !== 'collapsed'

  if (!labelAllowed) {
    return {
      name: '',
      description: '',
      shouldShowName: false,
      shouldShowDescription: false,
      fontHeight: 0,
      expansion: 0,
    }
  }

  const showLabels = readConfObject(config, 'showLabels') as boolean
  const showDescriptions = readConfObject(config, 'showDescriptions') as boolean
  const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
    feature,
  }) as number
  const expansion =
    (readConfObject(config, 'maxFeatureGlyphExpansion') as number) || 0
  const name = String(
    readConfObject(config, ['labels', 'name'], { feature }) || '',
  )
  const description = String(
    readConfObject(config, ['labels', 'description'], { feature }) || '',
  )
  const shouldShowName = /\S/.test(name) && showLabels
  const shouldShowDescription = /\S/.test(description) && showDescriptions

  const getWidth = (text: string) => {
    const glyphWidth = rootLayout.width + expansion
    const textWidth = measureText(text, fontHeight)
    return Math.round(Math.min(textWidth, glyphWidth))
  }

  if (shouldShowName) {
    rootLayout.addChild(
      'nameLabel',
      0,
      featureLayout.bottom,
      getWidth(name),
      fontHeight,
    )
  }

  if (shouldShowDescription) {
    const aboveLayout = shouldShowName
      ? rootLayout.getSubRecord('nameLabel')
      : featureLayout
    if (!aboveLayout) {
      throw new Error('failed to layout nameLabel')
    }
    rootLayout.addChild(
      'descriptionLabel',
      0,
      aboveLayout.bottom,
      getWidth(description),
      fontHeight,
    )
  }

  let floatingLabels: FloatingLabelData[] | undefined
  if (includeFloatingLabels) {
    const nameColor = readConfObject(config, ['labels', 'nameColor'], {
      feature,
    }) as string
    const descriptionColor = readConfObject(
      config,
      ['labels', 'descriptionColor'],
      { feature },
    ) as string
    floatingLabels = createFeatureFloatingLabels({
      name,
      description,
      showLabels,
      showDescriptions,
      fontHeight,
      nameColor,
      descriptionColor,
    })
  }

  return {
    name,
    description,
    shouldShowName,
    shouldShowDescription,
    fontHeight,
    expansion,
    floatingLabels,
  }
}

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
  } else if (type === 'CDS') {
    return CDS
  } else {
    return extraGlyphs?.find(f => f.validator(feature))?.glyph || Box
  }
}

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

export function layOutFeature(args: FeatureLayOutArgs) {
  const { layout, feature, bpPerPx, reversed, config, extraGlyphs } = args
  const displayMode = readConfObject(config, 'displayMode') as string
  const GlyphComponent =
    displayMode === 'reducedRepresentation'
      ? Box
      : chooseGlyphComponent({ feature, extraGlyphs, config })

  const parentFeature = feature.parent()
  const x = parentFeature
    ? (reversed
        ? parentFeature.get('end') - feature.get('end')
        : feature.get('start') - parentFeature.get('start')) / bpPerPx
    : 0

  const height = readConfObject(config, 'height', { feature }) as number
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const top = layout.parent?.top ?? 0

  return layout.addChild(
    feature.id(),
    x,
    displayMode === 'collapse' ? 0 : top,
    Math.max(width, 1),
    displayMode === 'compact' ? height / 2 : height,
    { GlyphComponent },
  )
}

export function layOutSubfeatures(args: SubfeatureLayOutArgs) {
  const { layout, subfeatures, bpPerPx, reversed, config, extraGlyphs } = args
  for (const feature of subfeatures) {
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

export function layoutFeatures({
  features,
  bpPerPx,
  region,
  config,
  layout,
  extraGlyphs,
  displayMode,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  layout: BaseLayout<unknown>
  extraGlyphs?: ExtraGlyphValidator[]
  displayMode: string
}): void {
  const { reversed } = region

  for (const feature of features.values()) {
    const rootLayout = new SceneGraph('root', 0, 0, 0, 0)
    const GlyphComponent = chooseGlyphComponent({ config, feature, extraGlyphs })
    const featureLayout = (GlyphComponent.layOut || layOut)({
      layout: rootLayout,
      feature,
      bpPerPx,
      reversed,
      config,
      extraGlyphs,
    })

    const totalFeatureHeight = featureLayout.height
    const { name, description, floatingLabels } = computeLabelLayout({
      feature,
      config,
      rootLayout,
      featureLayout,
      displayMode,
      includeFloatingLabels: true,
    })

    const layoutWidthBp = rootLayout.width * bpPerPx + xPadding * bpPerPx
    const [layoutStart, layoutEnd] = calculateLayoutBounds(
      feature.get('start'),
      feature.get('end'),
      layoutWidthBp,
      reversed,
    )

    layout.addRect(
      feature.id(),
      layoutStart,
      layoutEnd,
      rootLayout.height + yPadding,
      feature,
      {
        label: name || feature.get('name') || feature.get('id'),
        description:
          description || feature.get('description') || feature.get('note'),
        refName: feature.get('refName'),
        totalLayoutWidth: rootLayout.width + xPadding,
        ...(floatingLabels?.length
          ? { floatingLabels, totalFeatureHeight }
          : {}),
      },
    )
  }
}
