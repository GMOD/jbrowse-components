import { GAP_DELETION } from '../../shaders/slang/gap.consts.generated.ts'
import { qualityFade } from '../../shaders/slang/mismatch.js.generated.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../../shared/types.ts'
import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  MIN_QUALITY_LETTER_OPACITY,
  getInsertionType,
  insertionBarWidth,
  labelFadeOpacity,
  labelFont,
  minAvailPxForLabel,
} from '../constants.ts'
import {
  bandScreenTop,
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
  // The CSS font this label was MEASURED in, for `ctx.font`. Shared by every
  // label in a pass, and carried rather than rebuilt from a size so the fit
  // tests above and the draw cannot describe different fonts.
  font: string
  // 0-1 draw opacity. A deletion's length ramps down as its grey rect narrows,
  // so back-to-back deletions dissolve instead of popping when zoomed out, and a
  // SNP letter carries the same per-base quality fade its box does. The rest —
  // insertion counts, small insertions, clip summaries — stay 1.
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
  // Gates the three label groups whose LAYERS answer to it — deletion,
  // insertion, mismatch — and no more. `clip` is unconditional in
  // PILEUP_LAYERS and `softclipBases` is gated on `showSoftClipping`, so
  // gating the whole pass left those two drawn and unlabelled.
  showMismatches: boolean
  // "Fade low quality mismatches". The SNP letter has to honor it as well as the
  // box under it, or the setting does nothing at the one zoom it applies at.
  mismatchAlpha: boolean
  scrollTop: number
}

/**
 * The longest deletion and the longest interbase feature in one region's data.
 *
 * A size label survives only if its feature is wide enough on screen, and that
 * width is `length / bpPerPx` — so at a fixed zoom it is a test on the
 * feature's bp LENGTH, which no amount of panning changes. The longest feature
 * present therefore decides whether the walk below can emit anything at all,
 * and on a zoomed-out pileup it usually cannot.
 *
 * Measured on six BAM tracks at `chr22_mask:124000-143000` (jb2bench
 * `results/multibam-pan.md`): 595k gap and 906k interbase entries walked per
 * pan frame, producing **zero** labels, because the longest deletion in that
 * data is 16 bp against a threshold of 81. That walk was 19.5% of the whole
 * main-thread profile and about 80% of its JavaScript.
 *
 * Cached against the RPC result object itself, which is replaced wholesale on
 * refetch — so the cache invalidates itself, and a WeakMap holds nothing once
 * the data is dropped.
 */
const maxFeatureLengths = new WeakMap<
  object,
  { deletion: number; interbase: number }
>()

function getMaxFeatureLengths(rpcData: PileupDataResult) {
  const hit = maxFeatureLengths.get(rpcData)
  if (hit) {
    return hit
  }
  const { gapPositions, gapTypes, interbaseLengths } = rpcData
  let deletion = 0
  // Skips are never labelled, so a long intron must not keep the deletion walk
  // alive.
  for (let i = 0; i < gapTypes.length; i++) {
    if (gapTypes[i] !== GAP_DELETION) {
      continue
    }
    const length = gapPositions[i * 2 + 1]! - gapPositions[i * 2]!
    if (length > deletion) {
      deletion = length
    }
  }
  let interbase = 0
  for (let i = 0; i < interbaseLengths.length; i++) {
    if (interbaseLengths[i]! > interbase) {
      interbase = interbaseLengths[i]!
    }
  }
  const val = { deletion, interbase }
  maxFeatureLengths.set(rpcData, val)
  return val
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
    mismatchAlpha,
    scrollTop,
  } = params

  const labels: VisibleLabel[] = []
  const rowHeight = featureHeight + featureSpacing
  // One font for the pass, measured and drawn through the same object. Every
  // label carries `font.css` rather than a size the draw would have to rebuild a
  // font string from — one shared string reference, so it costs a pointer.
  const font = labelFont(featureHeight)
  const { bpPerPx } = view
  const pxPerBp = 1 / bpPerPx
  const tallEnoughForText = featureHeight >= MIN_HEIGHT_FOR_TEXT
  const canRenderText = pxPerBp >= MIN_PX_PER_BP_FOR_TEXT && tallEnoughForText
  const clipPrefix: Record<number, string | undefined> = {
    [INTERBASE_SOFTCLIP]: 'S',
    [INTERBASE_HARDCLIP]: 'H',
  }

  // Deletion length labels are measured per gap, and a pileup repeats the same
  // few lengths thousands of times, so memoize the measure (the font is fixed
  // for the whole pass). Keyed by the number to skip building the string too.
  const textWidthCache = new Map<number, number>()
  const gapTextWidth = (len: number) => {
    const hit = textWidthCache.get(len)
    if (hit !== undefined) {
      return hit
    }
    const w = font.measure(String(len))
    textWidthCache.set(len, w)
    return w
  }

  // The shortest deletion that could possibly carry a length label at this
  // zoom. Every digit is one table width in `measureText`, so a one-digit
  // string is the narrowest label any deletion can ask for, and a deletion
  // whose WHOLE span is narrower than that carries no label however it happens
  // to be placed. Necessary rather than sufficient: a deletion that passes
  // still runs the exact per-feature test below, against its visible span and
  // its own digit count.
  const minDeletionBp = minAvailPxForLabel(font.measure('0')) * bpPerPx
  // Same bound for the count on a 'large' insertion, which is exactly
  // `getInsertionType`'s two gates: LONG_INSERTION_MIN_LENGTH, and
  // LONG_INSERTION_TEXT_THRESHOLD_PX of span on screen.
  const minLargeInsertionBp = Math.max(
    LONG_INSERTION_MIN_LENGTH,
    LONG_INSERTION_TEXT_THRESHOLD_PX * bpPerPx,
  )

  const scroll = makeScroll(sections.length, scrollTop, height)
  for (const { laidOutPileupMap, topOffset, pileupHeight } of sections) {
    // Each stacked section places its labels at its own pileup top; ungrouped is
    // one section, so this reduces to the prior single-offset loop. See
    // sectionScreen.ts for the band-top-vs-content scroll tiers used here.
    //
    // contentScreenY is affine in the row index, so its projection is inlined at
    // each use below as `row * rowHeight + rowNudge - scrollTop` — same operand
    // order, so it stays bit-identical. It runs per candidate label (tens of
    // thousands on a deep pileup), where the call overhead alone was a top
    // frame in a pan/zoom profile.
    const rowNudge = featureHeight / 2 + topOffset
    // Clip to this section's pileup band bottom, not the whole canvas, so a
    // collapsed group (pileupHeight 0) draws nothing and a group's labels never
    // bleed into the section below it.
    const bottom = sectionBandBottom(topOffset, pileupHeight, scroll)
    const sectionTop = bandScreenTop(topOffset, scroll)
    for (const vr of view.visibleRegions) {
      const rpcData = laidOutPileupMap.get(vr.displayedRegionIndex)
      if (!rpcData) {
        continue
      }
      const blockStart = vr.start
      const blockEnd = vr.end
      const bpToPx = makeBpToPx(vr, bpPerPx)
      const maxLen = getMaxFeatureLengths(rpcData)

      // Screen-x spans of the wide purple boxes the GPU draws for large
      // insertions (insertion.slang), keyed by integer pileup row. A SNP letter
      // landing on one reads as a "purple SNP", so — matching hit-testing — the
      // insertion wins and the mismatch loop drops any letter it shadows.
      const insertionShadows: { row: number; x0: number; x1: number }[] = []

      // Process deletions (gaps)
      const { gapPositions, gapYs, gapTypes } = rpcData
      const numGaps = gapPositions.length / 2
      if (
        showMismatches &&
        tallEnoughForText &&
        maxLen.deletion >= minDeletionBp
      ) {
        for (let i = 0; i < numGaps; i++) {
          if (gapTypes[i] !== GAP_DELETION) {
            continue
          }

          const gapStart = gapPositions[i * 2]!
          const gapEnd = gapPositions[i * 2 + 1]!
          const length = gapEnd - gapStart

          if (gapEnd < blockStart || gapStart > blockEnd) {
            continue
          }

          // Cull off-band rows before measuring: the row test is two compares,
          // the fade needs a text measure, and on a tall pileup most rows are
          // off-band. Both tests are independent, so the surviving set is the
          // same either way.
          const yPx = gapYs[i]! * rowHeight + rowNudge - scrollTop
          if (yPx < sectionTop || yPx > bottom) {
            continue
          }

          // Measure and place against the VISIBLE part of the deletion, not the
          // whole thing. A deletion longer than the view has its midpoint
          // off-screen — a 50kb one enclosing a 1kb view put its label 20x the
          // canvas width to the right — so the grey bar filled the screen with
          // no length on it, which is the view where the length matters most.
          // The clamp is to the region's own bp range rather than the canvas
          // because each visible region owns its own screen slice.
          const visStart = Math.max(gapStart, blockStart)
          const visEnd = Math.min(gapEnd, blockEnd)

          // bpToPx is affine, so the rect's width is its bp span scaled and its
          // midpoint is the midpoint bp projected — no need to project both
          // edges and min/max them.
          const widthPx = (visEnd - visStart) / bpPerPx

          // Fade the length out as the visible rect narrows toward its own text
          // width, so back-to-back deletions dissolve smoothly when zooming out
          // instead of all vanishing at once — and so a deletion panned almost
          // off-screen drops its label instead of jamming it against the edge.
          const opacity = labelFadeOpacity(widthPx, gapTextWidth(length))
          if (opacity === 0) {
            continue
          }

          labels.push({
            type: 'deletion',
            x: bpToPx((visStart + visEnd) / 2),
            y: yPx,
            text: String(length),
            font: font.css,
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
      // Zoomed out, the only thing this loop can emit is the count on a 'large'
      // insertion — small-insertion `(N)`, clip summaries and the SNP letters
      // that read `insertionShadows` are all behind `canRenderText`. So when no
      // insertion in the data is long enough to be 'large' AND legible, the
      // whole walk is dead and its shadows have no reader.
      const numInterbases =
        canRenderText ||
        (showMismatches &&
          tallEnoughForText &&
          maxLen.interbase >= minLargeInsertionBp)
          ? interbasePositions.length
          : 0

      for (let i = 0; i < numInterbases; i++) {
        const pos = interbasePositions[i]!
        const length = interbaseLengths[i]!
        const type = interbaseTypes[i]!

        if (pos < blockStart || pos > blockEnd) {
          continue
        }

        const yPx = interbaseYs[i]! * rowHeight + rowNudge - scrollTop
        if (yPx < sectionTop || yPx > bottom) {
          continue
        }
        const xPx = bpToPx(pos)

        if (type === INTERBASE_INSERTION) {
          if (showMismatches) {
            const insertionType = getInsertionType(length, pxPerBp)
            if (insertionType === 'large') {
              const halfW =
                insertionBarWidth(length, pxPerBp, featureHeight) / 2
              insertionShadows.push({
                row: interbaseYs[i]!,
                x0: xPx - halfW,
                x1: xPx + halfW,
              })
              // The count arrives with its box, opaque. 'large' IS
              // insertion.slang's `isLarge`, the test that widens the marker into
              // a box sized for exactly these digits, so the room for the text is
              // never in question and there is nothing to fade against. The fade
              // this replaces ran on `length * pxPerBp`, which measures how big
              // the insertion is rather than whether it is legible — an insertion
              // consumes no reference bases, so that span is notional and the
              // digits never go there. It also cleared 5% two px of span AFTER
              // the box widened, so the box drew empty and then filled with 5%
              // digits.
              if (tallEnoughForText) {
                labels.push({
                  type: 'insertion',
                  x: xPx,
                  y: yPx,
                  text: String(length),
                  font: font.css,
                  opacity: 1,
                })
              }
            } else if (insertionType === 'small' && canRenderText) {
              labels.push({
                type: 'insertion',
                x: xPx + 3,
                y: yPx,
                text: `(${length})`,
                font: font.css,
                opacity: 1,
              })
            }
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
              font: font.css,
              opacity: 1,
            })
          }
        }
      }

      // Process mismatches
      const { mismatchPositions, mismatchYs, mismatchBases, mismatchQuals } =
        rpcData
      const numMismatches = mismatchPositions.length
      if (showMismatches && canRenderText) {
        for (let i = 0; i < numMismatches; i++) {
          const pos = mismatchPositions[i]!

          if (pos < blockStart || pos + 1 > blockEnd) {
            continue
          }

          const row = mismatchYs[i]!
          const yPx = row * rowHeight + rowNudge - scrollTop
          if (yPx < sectionTop || yPx > bottom) {
            continue
          }

          // Midpoint of the 1bp SNP rect; the average is orientation-independent.
          // bpToPx is affine, so projecting the midpoint bp is the same as
          // averaging the two projected edges, at one call instead of two.
          const centerPx = bpToPx(pos + 0.5)

          // Insertion wins: drop the letter when a large insertion box on this
          // row covers its center, otherwise it sits on purple and looks like a
          // SNP.
          const shadowed = insertionShadows.some(
            s => s.row === row && centerPx >= s.x0 && centerPx <= s.x1,
          )
          if (shadowed) {
            continue
          }

          // The letter carries the same quality fade `drawMismatches` /
          // mismatch.slang put on the box under it. Without this, "Fade low
          // quality mismatches" drew a 20%-alpha box under a fully opaque
          // letter — and letters only appear at base-level zoom, so the setting
          // did nothing at the only zoom it applies at. `qualityFade` is the
          // shader's own ramp (adr-051), the same call the box makes.
          //
          // The box's OTHER multiplier, the low-frequency fade, is deliberately
          // absent: its gate is `pxPerBp < 1` and letters need pxPerBp >= 6.5,
          // so it resolves to 1 wherever this loop runs.
          const opacity = qualityFade(mismatchQuals[i]!, mismatchAlpha)
          if (opacity < MIN_QUALITY_LETTER_OPACITY) {
            continue
          }

          labels.push({
            type: 'mismatch',
            x: centerPx,
            y: yPx,
            text: String.fromCharCode(mismatchBases[i]!),
            font: font.css,
            opacity,
          })
        }
      }

      // Per-base soft-clip letters (parity with legacy renderSoftClipping). The
      // arrays are only populated when "show soft clipping" is enabled, so this is
      // naturally empty otherwise. Reuses the 'mismatch' contrast-text coloring,
      // matching the base-color boxes the clipped bases draw under them.
      //
      // Opacity stays 1 rather than picking up the quality fade above: clipped
      // bases carry no per-base quality here — the softclip pass shares
      // mismatch.slang and packs QUAL_UNAVAILABLE, which `qualityFade` reads as
      // opaque — so these letters match their boxes by staying opaque too.
      if (canRenderText && hasSoftclipBases) {
        const numSoftclipBases = softclipBasePositions.length
        for (let i = 0; i < numSoftclipBases; i++) {
          const pos = softclipBasePositions[i]!
          if (pos < blockStart || pos + 1 > blockEnd) {
            continue
          }
          const yPx = softclipBaseYs[i]! * rowHeight + rowNudge - scrollTop
          if (yPx < sectionTop || yPx > bottom) {
            continue
          }
          const centerPx = bpToPx(pos + 0.5)
          labels.push({
            type: 'mismatch',
            x: centerPx,
            y: yPx,
            text: String.fromCharCode(softclipBaseBases[i]!),
            font: font.css,
            opacity: 1,
          })
        }
      }
    }
  }

  return labels
}
