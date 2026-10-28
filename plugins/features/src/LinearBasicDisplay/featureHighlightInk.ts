import { mergeBounds } from '@jbrowse/display-kit/highlightHost'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { inkOfInstances } from '@jbrowse/render-core/marks'

import { renderedTextWidth } from '../RenderFeatureDataRPC/constants.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'
import {
  labelsReachRegion,
  placeFeatureLabels,
} from './components/labelPositioning.ts'
import { BASIC_FEATURE_MARKS } from './marks/basicFeatureMarks.ts'
import { glyphMarkIndex } from './marks/featureGlyphMarks.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderState } from './components/featureRenderingBackendTypes.ts'
import type { PlacedLabel } from './components/labelPositioning.ts'
import type { NamedFeature } from '@jbrowse/display-kit/floatingLabelHost'
import type { HighlightRect } from '@jbrowse/display-kit/highlightHost'
import type { MarkInstance } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const INKED_MARKS = [
  { mark: glyphMarkIndex('line'), kind: 'line' },
  { mark: glyphMarkIndex('rect'), kind: 'rect' },
  { mark: glyphMarkIndex('arrow'), kind: 'arrow' },
] as const

/**
 * One region's primitives by what they belong to — the inverse of the payload's
 * `*FeatureIndices` / `*ChildOrdinals` lanes, which only a highlight needs and
 * so is built on the main thread when something is first lit.
 */
export interface RegionInstanceIndex {
  byFeatureId: Map<string, MarkInstance[]>
  bySubfeatureId: Map<string, MarkInstance[]>
}

function push<K>(map: Map<K, MarkInstance[]>, key: K, instance: MarkInstance) {
  const list = map.get(key)
  if (list) {
    list.push(instance)
  } else {
    map.set(key, [instance])
  }
}

export function buildRegionInstanceIndex(
  data: FeatureDataResult,
): RegionInstanceIndex {
  const byFeatureId = new Map<string, MarkInstance[]>()
  const byOrdinal = new Map<string, MarkInstance[]>()
  for (const { mark, kind } of INKED_MARKS) {
    const featureIndices = data[`${kind}FeatureIndices`]
    const ordinals = data[`${kind}ChildOrdinals`]
    for (let i = 0; i < featureIndices.length; i++) {
      const featureIndex = featureIndices[i]!
      const owner = data.flatbushItems[featureIndex]
      if (!owner) {
        continue
      }
      const instance = { mark, index: i }
      push(byFeatureId, owner.featureId, instance)
      const ordinal = ordinals[i]
      if (ordinal !== undefined && ordinal !== ROOT_CHILD_ORDINAL) {
        push(byOrdinal, `${featureIndex}\0${ordinal}`, instance)
      }
    }
  }

  // A grandchild registers under its own parent rather than the root, and the
  // worker emits parents first, so one forward pass carries the root's index
  // down to every depth.
  const rootIndexOf = new Map<string, number>()
  for (const [i, item] of data.flatbushItems.entries()) {
    rootIndexOf.set(item.featureId, i)
  }
  const bySubfeatureId = new Map<string, MarkInstance[]>()
  for (const info of data.subfeatureInfos) {
    const rootIndex = rootIndexOf.get(info.parentFeatureId)
    if (rootIndex === undefined) {
      continue
    }
    rootIndexOf.set(info.featureId, rootIndex)
    const instances =
      info.childOrdinal === undefined
        ? undefined
        : byOrdinal.get(`${rootIndex}\0${info.childOrdinal}`)
    if (instances) {
      bySubfeatureId.set(info.featureId, instances)
    }
  }
  return { byFeatureId, bySubfeatureId }
}

export interface FeatureInkHost {
  renderBlocks: readonly RenderBlock[]
  renderDataMap: ReadonlyMap<number, FeatureDataResult>
  renderState: RenderState
  regionInstanceIndexes: ReadonlyMap<number, RegionInstanceIndex>
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  renderedShowSubfeatureLabels: boolean
  renderedLabelFontSize: number
}

function regionIndices(blocks: readonly RenderBlock[]) {
  return [...new Set(blocks.map(b => b.displayedRegionIndex))]
}

// The canvas is what the box annotates, and the chrome clips nothing: a label
// row hanging below the last drawn row, or a name overhanging the right edge,
// would otherwise paint over the track below or beside this one.
function clipToCanvas(box: HighlightRect, state: RenderState) {
  const left = Math.max(box.left, 0)
  const top = Math.max(box.top, 0)
  const right = Math.min(box.left + box.width, state.canvasWidth)
  const bottom = Math.min(box.top + box.height, state.canvasHeight)
  return right > left && bottom > top
    ? { left, top, width: right - left, height: bottom - top }
    : undefined
}

// The labels one region drew for a feature, in content px, placed in the first
// of its blocks they reach.
function placedLabels(
  self: FeatureInkHost,
  data: FeatureDataResult,
  featureId: string,
  blocks: readonly RenderBlock[],
): PlacedLabel[] {
  const labelData = data.floatingLabelsData.get(featureId)
  if (!labelData) {
    return []
  }
  const context = {
    showLabels: self.renderedShowLabels,
    showDescriptions: self.renderedShowDescriptions,
    showSubfeatureLabels: self.renderedShowSubfeatureLabels,
    fontSize: self.renderedLabelFontSize,
  }
  const block = blocks.find(b =>
    labelsReachRegion(
      labelData,
      b,
      context.showLabels,
      context.showDescriptions,
      context.fontSize,
    ),
  )
  return block
    ? placeFeatureLabels(labelData, makeBpMapper(block), block, context)
    : []
}

// The label rows a feature painted, in the same content px the ink is in less
// the scroll. A label wider than its feature overhangs it, and nothing clips
// that back: the box is meant to cover the text as drawn.
function labelRects(
  self: FeatureInkHost,
  data: FeatureDataResult,
  featureId: string,
  blocks: readonly RenderBlock[],
): HighlightRect[] {
  const { scrollY } = self.renderState
  return placedLabels(self, data, featureId, blocks).map(placed => {
    const size =
      placed.kind === 'more' ? self.renderedLabelFontSize : placed.fontSize
    return {
      left: placed.labelX,
      top: placed.labelY - scrollY,
      width: renderedTextWidth(placed.label.textWidth, size),
      height: size,
    }
  })
}

/**
 * The text of every label drawn for these features, the isoform badge aside.
 */
export function drawnLabelTexts(
  self: FeatureInkHost,
  featureIds: readonly string[],
): Set<string> {
  const texts = new Set<string>()
  for (const idx of regionIndices(self.renderBlocks)) {
    const data = self.renderDataMap.get(idx)
    if (!data) {
      continue
    }
    const blocks = self.renderBlocks.filter(b => b.displayedRegionIndex === idx)
    for (const featureId of featureIds) {
      for (const placed of placedLabels(self, data, featureId, blocks)) {
        if (placed.kind !== 'more') {
          texts.add(placed.label.text)
        }
      }
    }
  }
  return texts
}

/**
 * Every named top-level feature once, boxed over the body it drew without its
 * labels: what a host placing names itself anchors them to.
 */
export function namedFeatureInk(self: FeatureInkHost): NamedFeature[] {
  const out: NamedFeature[] = []
  const named = new Set<string>()
  for (const idx of regionIndices(self.renderBlocks)) {
    const index = self.regionInstanceIndexes.get(idx)
    const data = self.renderDataMap.get(idx)
    if (!data || !index) {
      continue
    }
    const blocks = self.renderBlocks.filter(b => b.displayedRegionIndex === idx)
    for (const { featureId, name } of data.flatbushItems) {
      const instances = index.byFeatureId.get(featureId)
      if (!name || !instances || named.has(featureId)) {
        continue
      }
      const merged = mergeBounds(
        inkOfInstances(
          BASIC_FEATURE_MARKS,
          blocks,
          () => data,
          self.renderState,
          () => instances,
        ),
      )
      const box = merged && clipToCanvas(merged, self.renderState)
      if (box) {
        named.add(featureId)
        out.push({ featureId, text: name, ...box })
      }
    }
  }
  return out
}

/**
 * One box per region per feature — or per single subfeature of one — covering
 * every primitive it painted through the marks' own `ink` plus the rows its
 * labels drew, merged. Reads the morphed `renderDataMap`, so a box travels with
 * a glyph still easing toward its row, and a feature scrolled off the canvas
 * inks nothing because each shape culls its own row.
 *
 * Takes a set because three of the four lists it answers light a set: one
 * hovered feature, one selected feature, every pinned one and every one
 * collected for a solo. An empty set returns before touching
 * `regionInstanceIndexes`, which nothing else builds.
 */
export function featureHighlightInk(
  self: FeatureInkHost,
  featureIds: Iterable<string>,
): HighlightRect[] {
  const ids = [...featureIds]
  if (ids.length === 0) {
    return []
  }
  const out: HighlightRect[] = []
  const labelled = new Set<string>()
  for (const idx of regionIndices(self.renderBlocks)) {
    const index = self.regionInstanceIndexes.get(idx)
    const data = self.renderDataMap.get(idx)
    if (!data || !index) {
      continue
    }
    const blocks = self.renderBlocks.filter(b => b.displayedRegionIndex === idx)
    for (const featureId of ids) {
      const instances =
        index.byFeatureId.get(featureId) ?? index.bySubfeatureId.get(featureId)
      if (!instances) {
        continue
      }
      const rects = inkOfInstances(
        BASIC_FEATURE_MARKS,
        blocks,
        () => data,
        self.renderState,
        () => instances,
      )
      if (rects.length === 0) {
        continue
      }
      // A feature spanning two regions draws its labels once, where the overlay
      // draws them.
      if (!labelled.has(featureId)) {
        const labels = labelRects(self, data, featureId, blocks)
        if (labels.length > 0) {
          labelled.add(featureId)
        }
        rects.push(...labels)
      }
      const merged = mergeBounds(rects)
      const box = merged && clipToCanvas(merged, self.renderState)
      if (box) {
        out.push(box)
      }
    }
  }
  return out
}
