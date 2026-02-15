import { readCachedConfig } from '../renderConfig.ts'
import { layoutChild } from './glyphUtils.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const MATURE_PROTEIN_TYPES = new Set([
  'mature_protein_region_of_CDS',
  'mature_protein_region',
])

function getMatureProteinChildren(feature: Feature): Feature[] {
  const subfeatures = feature.get('subfeatures')
  return (
    subfeatures?.filter(sub => MATURE_PROTEIN_TYPES.has(sub.get('type'))) ?? []
  )
}

function sortByPosition(children: FeatureLayout[]) {
  return [...children].sort((a, b) => {
    const aStart = a.feature.get('start')
    const bStart = b.feature.get('start')
    if (aStart !== bStart) {
      return aStart - bStart
    }
    return b.feature.get('end') - a.feature.get('end')
  })
}

export const matureProteinRegionGlyph: Glyph = {
  type: 'MatureProteinRegion',
  hasIndexableChildren: true,

  match(feature) {
    if (feature.get('type') !== 'CDS') {
      return false
    }
    return getMatureProteinChildren(feature).length > 0
  },

  getSubfeatureMouseover(feature: Feature) {
    const product = feature.get('product') as string | undefined
    const proteinId = feature.get('protein_id') as string | undefined
    const parts: string[] = []
    if (product) {
      parts.push(product)
    }
    if (proteinId) {
      parts.push(`(${proteinId})`)
    }
    return parts.length > 0 ? parts.join(' ') : undefined
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, featureHeight, heightMultiplier, subfeatureLabels } =
      configContext

    const start = feature.get('start')
    const end = feature.get('end')
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (end - start) / bpPerPx

    const matureProteins = getMatureProteinChildren(feature)
    const children = matureProteins.map(child =>
      layoutChild(child, feature, args),
    )

    const sortedChildren = sortByPosition(children)
    const numRows = Math.max(1, sortedChildren.length)
    const perRowMultiplier = subfeatureLabels === 'below' ? 2 : 1
    const rowHeight = baseHeightPx * perRowMultiplier
    const totalHeight = rowHeight * numRows

    const padding = 1
    const boxHeight =
      subfeatureLabels === 'below'
        ? Math.floor(rowHeight / 2) - padding
        : rowHeight - padding * 2

    for (const [i, sortedChild] of sortedChildren.entries()) {
      const child = sortedChild
      child.y = i * rowHeight + padding
      child.height = boxHeight
      child.totalLayoutHeight = rowHeight
    }

    return {
      feature,
      glyphType: 'MatureProteinRegion',
      x: 0,
      y: 0,
      width: widthPx,
      height: totalHeight,
      totalLayoutHeight: totalHeight,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children: sortedChildren,
    }
  },
}
