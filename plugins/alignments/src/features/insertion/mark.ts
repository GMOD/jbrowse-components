import {
  drawInsertionSerifs,
  insertionSerifsWidthPx,
} from '@jbrowse/alignments-core'
import { defineMark } from '@jbrowse/render-core/marks'

import {
  rgb255,
  rgbaPrefix255,
} from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { getInsertionType } from '../../LinearAlignmentsDisplay/constants.ts'
import * as insertionShader from '../../shaders/slang/insertion.generated.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  Point,
  countMarks,
  markSelects,
  pileupShape,
} from '../pileupShape.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'
import type { InsertionType } from '@jbrowse/alignments-core'

function packInsertions(c: PileupChannels) {
  const { positions, rows, kinds, kind, lengths, freqs, end } = c
  const F_F32 = insertionShader.INSTANCE_OFFSET_F32
  const F_U32 = insertionShader.INSTANCE_OFFSET_U32
  const s32 = insertionShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(
    countMarks(c) * insertionShader.INSTANCE_STRIDE_BYTES,
  )
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = c.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.position] = positions[i]!
      u32[o + F_U32.y] = rows[i]!
      u32[o + F_U32.length] = lengths![i]!
      f32[o + F_F32.frequency] = freqs![i]! / 255
      o += s32
    }
  }
  return buf
}

// The worker lays the merged interbase array out as (insertions, softclips,
// hardclips), so the insertions are its prefix. The bound is what lets a
// per-entry type test go: this and the two clip marks each used to walk the
// whole array, so one hover scanned it three times over to reject most of it on
// a byte the layout already guarantees.
export function insertionChannels(data: InterbaseUploadData): PileupChannels {
  return {
    positions: data.interbasePositions,
    stride: 1,
    rows: data.interbaseYs,
    start: 0,
    end: data.numInsertions,
    kinds: undefined,
    kind: 0,
    freqs: data.interbaseFrequencies,
    quals: undefined,
    lengths: data.interbaseLengths,
    keys: undefined,
  }
}

export function insertionHit(
  data: InterbaseUploadData & { interbaseSequences: string[] },
  i: number,
): CigarHitResult {
  return {
    type: 'insertion',
    index: i,
    position: data.interbasePositions[i]!,
    length: data.interbaseLengths[i] ?? 0,
    sequence: data.interbaseSequences[i] || undefined,
  }
}

/**
 * The insertions of one size class, back to front — the candidate set the hit
 * chain hands `INSERTION_MARK.hitNearest` at each of its two slots. Insertions
 * are tested twice in `hitTestCigarItem` — a large insertion's labelled box
 * wins over a mismatch, a small one's thin bar loses to it — and the slot
 * depends on the zoom, so it is the caller's candidate filter rather than the
 * mark's draw rule.
 */
export function* insertionsOfSize(
  data: InterbaseUploadData,
  size: 'large' | 'small',
  pxPerBp: number,
) {
  const { interbaseLengths, numInsertions } = data
  for (let i = numInsertions - 1; i >= 0; i--) {
    const type: InsertionType = getInsertionType(interbaseLengths[i]!, pxPerBp)
    if (size === 'large' ? type !== 'small' : type === 'small') {
      yield i
    }
  }
}

/**
 * One insertion: a marker centred on the bp edge it sits between, on one pileup
 * row. The first `point` mark: the bar is the shape's, drawn from the mark's
 * width rule so one expression serves both the painter and the hit tolerance,
 * and the serif caps a small insertion wears on top of it are this feature's
 * decoration, shared with plugin-maf so the two displays draw one glyph.
 *
 * `featureHeight` reaches the width rule off the state: `insertionBarWidth`
 * gates the wide count-label box on the row being tall enough to draw a count
 * in, so a compact pileup's hit target narrows with its ink. insertion.slang
 * sizes its own quad from `length` and the row-height uniform (adr-051), so no
 * width crosses into the buffer.
 */
export const INSERTION_MARK = defineMark({
  shape: pileupShape({
    id: 'insertion',
    mod: insertionShader,
    pack: packInsertions,
    pivot: 'point',
    fade: Fade.insertion,
    hit: Hit.insertion,
    band: Band.row,
    // A marker is sparse and stands over a read body; nothing abuts it.
    contiguous: false,
    point: Point.insertionBar,
    paint: state => ({
      rule: Paint.palette,
      opaqueCss: [rgb255(state.colors.colorInsertion)],
      fadedCss: [rgbaPrefix255(state.colors.colorInsertion)],
    }),
    decorate: {
      draw: (ctx, x, top, height, c, i, pxPerBp) => {
        drawInsertionSerifs(ctx, x, top, height, c.lengths![i]!, pxPerBp)
      },
      widthPx: (c, i, pxPerBp) =>
        insertionSerifsWidthPx(c.lengths![i]!, pxPerBp),
    },
  }),
  channels: insertionChannels,
  params: (state: RenderState) => state,
  enabled: s => s.showMismatches,
})
