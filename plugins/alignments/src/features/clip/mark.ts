import { defineMark } from '@jbrowse/render-core/marks'

import {
  rgb255,
  rgbaPrefix255,
} from '../../LinearAlignmentsDisplay/colorUtils.ts'
import * as clipShader from '../../shaders/slang/clip.generated.ts'
import { INTERBASE_HARDCLIP, INTERBASE_SOFTCLIP } from '../../shared/types.ts'
import { interbaseRangeEnds } from '../../shared/uploadTypes.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  Point,
  backToFront,
  countMarks,
  markSelects,
  pileupShape,
} from '../pileupShape.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { PileupChannels } from '../pileupShape.ts'

// Per-instance kind discriminator written into the clip pass — same shader
// renders both soft and hard clips, branching on `kind` for color.
const CLIP_KIND_SOFT = 0
const CLIP_KIND_HARD = 1

// Soft and hard clips pack into a single instanced draw with a per-instance
// kind, in the array's own order — which is the order the two hit scans read
// it in.
function packClips(c: PileupChannels) {
  const { positions, rows, kinds, kind, keys, freqs, end } = c
  const F_F32 = clipShader.INSTANCE_OFFSET_F32
  const F_U32 = clipShader.INSTANCE_OFFSET_U32
  const s32 = clipShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(countMarks(c) * clipShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let o = 0
  for (let i = c.start; i < end; i++) {
    if (markSelects(kinds, kind, i)) {
      u32[o + F_U32.position] = positions[i]!
      u32[o + F_U32.y] = rows[i]!
      f32[o + F_F32.frequency] = freqs![i]! / 255
      u32[o + F_U32.kind] =
        keys![i] === INTERBASE_HARDCLIP ? CLIP_KIND_HARD : CLIP_KIND_SOFT
      o += s32
    }
  }
  return buf
}

// The worker lays interbases out as (insertions, softclips, hardclips), so the
// clips are the array's tail, and the type byte it ships beside each entry is
// what the packer's kind and the painter's colour read.
export function clipChannels(data: InterbaseUploadData): PileupChannels {
  const { insEnd, hcEnd } = interbaseRangeEnds(data)
  return {
    positions: data.interbasePositions,
    stride: 1,
    rows: data.interbaseYs,
    start: insEnd,
    end: hcEnd,
    kinds: undefined,
    kind: 0,
    freqs: data.interbaseFrequencies,
    quals: undefined,
    lengths: undefined,
    keys: data.interbaseTypes,
  }
}

/**
 * The clips of one kind, back to front. TWO candidate sets, softclips then
 * hardclips, because two independent rules meet at the hit test and one scan
 * could only express one of them:
 *
 *   - **Softclip beats hardclip** at the same row and position. That is the
 *     worker's array layout talking, not scan order, so it is the order the
 *     two sets are handed over in.
 *   - **Within a kind, the topmost bar wins** — the rule every mark's row scan
 *     applies, which matters where a collapsed group or a chain puts several
 *     reads on one row.
 *
 * Fused into one backward walk those two disagreed: the first rule silently
 * became "whichever kind sits later in the array", i.e. the hard clip.
 */
export function clipsOfKind(
  data: InterbaseUploadData,
  kind: 'soft' | 'hard',
): Iterable<number> {
  const { insEnd, scEnd, hcEnd } = interbaseRangeEnds(data)
  return kind === 'soft'
    ? backToFront(insEnd, scEnd)
    : backToFront(scEnd, hcEnd)
}

export function clipHit(data: InterbaseUploadData, i: number): CigarHitResult {
  return {
    type:
      data.interbaseTypes[i] === INTERBASE_HARDCLIP ? 'hardclip' : 'softclip',
    index: i,
    position: data.interbasePositions[i]!,
    length: data.interbaseLengths[i]!,
  }
}

// A 256-entry table indexed by the interbase type byte, the two clip kinds
// filled and everything else the soft colour — the same fallback clip.slang's
// `kind` branch takes for a byte that is not the hard kind. Memoized on the
// palette, since the painter asks per block.
function clipTable(soft: string, hard: string) {
  const table = new Array<string>(256).fill(soft)
  table[INTERBASE_SOFTCLIP] = soft
  table[INTERBASE_HARDCLIP] = hard
  return table
}

let tableMemo:
  | { colors: RenderState['colors']; opaqueCss: string[]; fadedCss: string[] }
  | undefined

function clipTables(state: RenderState) {
  const { colors } = state
  if (tableMemo?.colors !== colors) {
    tableMemo = {
      colors,
      opaqueCss: clipTable(
        rgb255(colors.colorSoftclip),
        rgb255(colors.colorHardclip),
      ),
      fadedCss: clipTable(
        rgbaPrefix255(colors.colorSoftclip),
        rgbaPrefix255(colors.colorHardclip),
      ),
    }
  }
  return tableMemo
}

/**
 * One clip bar: a 1px marker at the alignment edge where a read's soft or hard
 * clip begins, on its pileup row. One shader, one instance buffer and one mark
 * with a per-instance kind, two colours on the canvas — and two hit scans,
 * which are the caller's candidate sets (`clipsOfKind`).
 *
 * Sub-pixel frequency fade, clip.slang's. The hit gate is the same one the
 * mismatch and small-insertion tests use, off the same byte the shader fades
 * by: this was the one mark hit test without it, so a clip faded to the noise
 * floor still intercepted clicks that every other faded mark hands back to the
 * read body underneath. A clip bar's width and its tolerance are both
 * constants (`Point.clipBar`). Drawn at every zoom, so hit at every zoom.
 */
export const CLIP_MARK = defineMark({
  shape: pileupShape({
    id: 'clip',
    mod: clipShader,
    pack: packClips,
    pivot: 'point',
    fade: Fade.pointFrequency,
    hit: Hit.frequency,
    band: Band.row,
    contiguous: false,
    point: Point.clipBar,
    paint: state => {
      const { opaqueCss, fadedCss } = clipTables(state)
      return { rule: Paint.palette, opaqueCss, fadedCss }
    },
  }),
  channels: clipChannels,
  params: (state: RenderState) => state,
})
