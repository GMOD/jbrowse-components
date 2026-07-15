import { measureText } from '@jbrowse/core/util'

import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import {
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  MIN_LABEL_OPACITY,
  MIN_PX_PER_BP_FOR_TEXT,
  computeLabelFontSize,
  getInsertionType,
  insertionBarWidth,
  labelFadeOpacity,
} from '../constants.ts'
import {
  bandScreenTop,
  contentScreenY,
  makeBpToPx,
  makeScroll,
  sectionBandBottom,
} from './sectionScreen.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

export interface VisibleLabel {
  type: 'deletion' | 'insertion' | 'softclip' | 'hardclip' | 'mismatch'
  x: number
  y: number
  text: string
  fontSize: number
  // 0-1 draw opacity. Size labels on large indels ramp this down as their
  // feature narrows so they fade out instead of popping when zoomed out; the
  // per-base labels (mismatches, small insertions, clip summaries) stay 1.
  opacity: number
}

interface LabelView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

// One stacked group's data + its pileup-row top offset (screen px, pre-scroll).
// Ungrouped is a single section whose topOffset is coverageDisplayHeight.
// `pileupHeight` is the section's pileup band height: collapsed groups have 0,
// so their labels clip away instead of overflowing into the next section.
export interface LabelSection {
  laidOutPileupMap: { get(idx: number): PileupDataResult | undefined }
  topOffset: number
  pileupHeight: number
}

interface ComputeVisibleLabelsParams {
  view: LabelView
  sections: LabelSection[]
  height: number
  featureHeight: number
  featureSpacing: number
  showMismatches: boolean
  scrollTop: number
}

export function computeVisibleLabels(
  params: ComputeVisibleLabelsParams,
): VisibleLabel[] {
  const {
    view,
    sections,
    height,
    featureHeight,
    featureSpacing,
    showMismatches,
    scrollTop,
  } = params

  const labels: VisibleLabel[] = []

  if (!showMismatches) {
    return labels
  }

  const rowHeight = featureHeight + featureSpacing
  const fontSize = computeLabelFontSize(featureHeight)
  const { bpPerPx } = view
  const pxPerBp = 1 / bpPerPx
  const tallEnoughForText = featureHeight >= MIN_HEIGHT_FOR_TEXT
  const canRenderText = pxPerBp >= MIN_PX_PER_BP_FOR_TEXT && tallEnoughForText
  const clipPrefix: Record<number, string | undefined> = {
    [INTERBASE_SOFTCLIP]: 'S',
    [INTERBASE_HARDCLIP]: 'H',
  }

  // Each stacked section places its labels at its own pileup top; ungrouped is
  // one section, so this reduces to the prior single-offset loop. See
  // sectionScreen.ts for the band-top-vs-content scroll tiers used below.
  const scroll = makeScroll(sections.length, scrollTop, height)
  for (const { laidOutPileupMap, topOffset, pileupHeight } of sections) {
    const rowYPx = (y: number) =>
      contentScreenY(y * rowHeight + featureHeight / 2 + topOffset, scroll)
    // Clip to this section's pileup band bottom, not the whole canvas, so a
    // collapsed group (pileupHeight 0) draws nothing and a group's labels never
    // bleed into the section below it.
    const bottom = sectionBandBottom(topOffset, pileupHeight, scroll)
    const sectionTop = bandScreenTop(topOffset, scroll)
    const rowYInRange = (yPx: number) => yPx >= sectionTop && yPx <= bottom
    for (const vr of view.visibleRegions) {
      const rpcData = laidOutPileupMap.get(vr.displayedRegionIndex)
      if (!rpcData) {
        continue
      }
      const blockStart = vr.start
      const blockEnd = vr.end
      const bpToPx = makeBpToPx(vr, bpPerPx)

      // Screen-x spans of the wide purple boxes the GPU draws for large
      // insertions (insertion.slang), keyed by integer pileup row. A SNP letter
      // landing on one reads as a "purple SNP", so — matching hit-testing — the
      // insertion wins and the mismatch loop drops any letter it shadows.
      const insertionShadows: { row: number; x0: number; x1: number }[] = []

      // Process deletions (gaps)
      const { gapPositions, gapYs, gapLengths, gapTypes } = rpcData
      const numGaps = gapPositions.length / 2
      if (tallEnoughForText) {
        for (let i = 0; i < numGaps; i++) {
          if (gapTypes[i] !== 0) {
            continue
          }

          const gapStart = gapPositions[i * 2]!
          const gapEnd = gapPositions[i * 2 + 1]!
          const length = gapLengths[i]!

          if (gapEnd < blockStart || gapStart > blockEnd) {
            continue
          }

          const rawStartPx = bpToPx(gapStart)
          const rawEndPx = bpToPx(gapEnd)
          const startPx = Math.min(rawStartPx, rawEndPx)
          const endPx = Math.max(rawStartPx, rawEndPx)
          const widthPx = endPx - startPx

          const lengthStr = String(length)
          const textWidth = measureText(lengthStr, fontSize)

          // Fade the length out as the deletion rect narrows toward its own text
          // width, so back-to-back deletions dissolve smoothly when zooming out
          // instead of all vanishing at once.
          const opacity = labelFadeOpacity(widthPx, textWidth)
          if (opacity < MIN_LABEL_OPACITY) {
            continue
          }

          const yPx = rowYPx(gapYs[i]!)
          if (!rowYInRange(yPx)) {
            continue
          }

          labels.push({
            type: 'deletion',
            x: (startPx + endPx) / 2,
            y: yPx,
            text: lengthStr,
            fontSize,
            opacity,
          })
        }
      }

      // Process interbase features (insertions, softclips, hardclips)
      const {
        interbasePositions,
        interbaseYs,
        interbaseLengths,
        interbaseTypes,
      } = rpcData
      // Per-base soft-clip sequence; only populated when "show soft clipping" is
      // enabled. When present and zoomed in enough for letters, the per-base loop
      // below draws the clipped bases, so the (S<len>) summary is suppressed.
      const { softclipBasePositions, softclipBaseYs, softclipBaseBases } =
        rpcData
      const hasSoftclipBases = softclipBasePositions.length > 0
      const numInterbases = interbasePositions.length

      for (let i = 0; i < numInterbases; i++) {
        const pos = interbasePositions[i]!
        const length = interbaseLengths[i]!
        const type = interbaseTypes[i]!

        if (pos < blockStart || pos > blockEnd) {
          continue
        }

        const yPx = rowYPx(interbaseYs[i]!)
        if (!rowYInRange(yPx)) {
          continue
        }
        const xPx = bpToPx(pos)

        if (type === INTERBASE_INSERTION) {
          const insertionType = getInsertionType(length, pxPerBp)
          if (insertionType === 'large') {
            const halfW = insertionBarWidth(length, pxPerBp, featureHeight) / 2
            insertionShadows.push({
              row: interbaseYs[i]!,
              x0: xPx - halfW,
              x1: xPx + halfW,
            })
            // Fade the count out as the insertion's on-screen span shrinks
            // toward the 'large' threshold, so a wall of back-to-back insertions
            // dissolves smoothly when zooming out instead of popping off at once.
            const opacity = labelFadeOpacity(
              length * pxPerBp,
              LONG_INSERTION_TEXT_THRESHOLD_PX,
            )
            if (tallEnoughForText && opacity >= MIN_LABEL_OPACITY) {
              labels.push({
                type: 'insertion',
                x: xPx,
                y: yPx,
                text: String(length),
                fontSize,
                opacity,
              })
            }
          } else if (insertionType === 'small' && canRenderText) {
            labels.push({
              type: 'insertion',
              x: xPx + 3,
              y: yPx,
              text: `(${length})`,
              fontSize,
              opacity: 1,
            })
          }
        } else if (canRenderText) {
          const prefix = clipPrefix[type]
          // suppress the soft-clip summary when per-base clip letters are drawn
          const perBaseDrawn = type === INTERBASE_SOFTCLIP && hasSoftclipBases
          if (prefix !== undefined && !perBaseDrawn) {
            labels.push({
              type: type === INTERBASE_SOFTCLIP ? 'softclip' : 'hardclip',
              x: xPx + 3,
              y: yPx,
              text: `(${prefix}${length})`,
              fontSize,
              opacity: 1,
            })
          }
        }
      }

      // Process mismatches
      const { mismatchPositions, mismatchYs, mismatchBases } = rpcData
      const numMismatches = mismatchPositions.length
      if (canRenderText) {
        for (let i = 0; i < numMismatches; i++) {
          const pos = mismatchPositions[i]!

          if (pos < blockStart || pos + 1 > blockEnd) {
            continue
          }

          const row = mismatchYs[i]!
          const yPx = rowYPx(row)
          if (!rowYInRange(yPx)) {
            continue
          }

          // Midpoint of the 1bp SNP rect; the average is orientation-independent.
          const centerPx = (bpToPx(pos) + bpToPx(pos + 1)) / 2

          // Insertion wins: drop the letter when a large insertion box on this
          // row covers its center, otherwise it sits on purple and looks like a
          // SNP.
          const shadowed = insertionShadows.some(
            s => s.row === row && centerPx >= s.x0 && centerPx <= s.x1,
          )
          if (shadowed) {
            continue
          }

          labels.push({
            type: 'mismatch',
            x: centerPx,
            y: yPx,
            text: String.fromCharCode(mismatchBases[i]!),
            fontSize,
            opacity: 1,
          })
        }
      }

      // Per-base soft-clip letters (parity with legacy renderSoftClipping). The
      // arrays are only populated when "show soft clipping" is enabled, so this is
      // naturally empty otherwise. Reuses the 'mismatch' contrast-text coloring,
      // matching the base-color boxes the clipped bases draw under them.
      if (canRenderText && hasSoftclipBases) {
        const numSoftclipBases = softclipBasePositions.length
        for (let i = 0; i < numSoftclipBases; i++) {
          const pos = softclipBasePositions[i]!
          if (pos < blockStart || pos + 1 > blockEnd) {
            continue
          }
          const yPx = rowYPx(softclipBaseYs[i]!)
          if (!rowYInRange(yPx)) {
            continue
          }
          const centerPx = (bpToPx(pos) + bpToPx(pos + 1)) / 2
          labels.push({
            type: 'mismatch',
            x: centerPx,
            y: yPx,
            text: String.fromCharCode(softclipBaseBases[i]!),
            fontSize,
            opacity: 1,
          })
        }
      }
    }
  }

  return labels
}
