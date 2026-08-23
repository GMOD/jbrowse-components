import { reducePrecision, sum, toLocale, toPrecision } from './numericUtils.ts'

import type { Region } from './types/data.ts'

export interface MinimalRegion {
  start: number
  end: number
  reversed?: boolean
}

function roundToNearestPointOne(num: number) {
  return Math.round(num * 10) / 10
}

export function bpToPx(
  bp: number,
  {
    reversed,
    end = 0,
    start = 0,
  }: { start?: number; end?: number; reversed?: boolean },
  bpPerPx: number,
) {
  return roundToNearestPointOne((reversed ? end - bp : bp - start) / bpPerPx)
}

export function bpSpanPx(
  leftBp: number,
  rightBp: number,
  region: MinimalRegion,
  bpPerPx: number,
) {
  const start = bpToPx(leftBp, region, bpPerPx)
  const end = bpToPx(rightBp, region, bpPerPx)
  return region.reversed ? ([end, start] as const) : ([start, end] as const)
}

export function featureSpanPx(
  feature: { get: (key: string) => number },
  region: MinimalRegion,
  bpPerPx: number,
) {
  return bpSpanPx(feature.get('start'), feature.get('end'), region, bpPerPx)
}

export function getBpDisplayStr(total: number) {
  // the unit comes from the rounded value, not the raw one: 3-significant-digit
  // rounding of 999,500bp reaches 1000, which reads as "1Mbp" not "1,000Kbp"
  const mb = toPrecision(total / 1_000_000)
  return mb >= 1
    ? `${toLocale(mb)}Mbp`
    : total >= 1000
      ? `${reducePrecision(total / 1_000)}Kbp`
      : `${Math.floor(total)}bp`
}

const BP_UNITS: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  g: 1_000_000_000,
}

/**
 * The grammar of a single base-pair quantity, as a regex source fragment so
 * that callers matching it in a larger pattern (a locString coordinate range,
 * say) stay in step with {@link parseBpString}. Match case-insensitively.
 *
 * A decimal point is allowed only on the unit-suffixed alternative. That is
 * deliberate: "1.5Mb" is a number a user means, whereas a bare "1.5" as a
 * coordinate is a mistake, and it should stay an error rather than silently
 * yielding a fractional coordinate.
 */
export const BP_QUANTITY_SOURCE = String.raw`(?:-?\d+(?:\.\d+)?[kmg](?:bp?)?|-?\d+(?:bp)?)`

const BP_QUANTITY_REGEX = new RegExp(
  String.raw`^(?:(-?\d+(?:\.\d+)?)([kmg])(?:bp?)?|(-?\d+)(?:bp)?)$`,
  'i',
)

/**
 * Parse a base-pair count written the way people type one: plain digits, with
 * optional thousand separators, and with an optional metric unit suffix. So
 * "150", "1,500", "1.5kb", "1.5k", "34Mb" and "2G" are all accepted.
 *
 * The unit's tail is loose because both "kb" and "k" are in common use, and
 * because everything {@link getBpDisplayStr} prints has to come back in. The
 * app shows a window size as "1.5Mbp" in the zoom slider tooltip and over a
 * rubberband selection, so a user who reads one off the screen and types it
 * into a bp field has typed a string this must accept.
 *
 * Returns undefined, rather than NaN or a throw, when the string is not a bp
 * quantity, so that callers validating a text field can test it directly.
 */
export function parseBpString(str: string) {
  const match = BP_QUANTITY_REGEX.exec(str.replaceAll(',', ''))
  if (!match) {
    return undefined
  }
  const [, scaled, unit, plain] = match
  return plain === undefined
    ? // rounded because the scaled value can land off an integer ("1.0000001M"),
      // and a coordinate is a whole number of bases
      Math.round(+scaled! * BP_UNITS[unit!.toLowerCase()]!)
    : +plain
}

export function getTickDisplayStr(totalBp: number, bpPerPx: number) {
  return Math.floor(bpPerPx / 1_000) > 0
    ? `${toLocale(Number.parseFloat((totalBp / 1_000_000).toFixed(2)))}M`
    : toLocale(Math.floor(totalBp))
}

interface VirtualOffset {
  blockPosition: number
  dataPosition?: number
}

interface Block {
  minv: VirtualOffset
  maxv: VirtualOffset
  /**
   * Bytes this block's fetch actually reads. @gmod/tabix and @gmod/bam compute
   * it from an `endPosition` that `clampChunkEnds` has tightened down to the
   * next known BGZF block boundary, so it is materially smaller than the
   * full-block padding the fallback below has to assume.
   */
  fetchedSize?: () => number
}

/**
 * Index-only estimate of the bytes a fetch of these regions would download.
 *
 * Prefers each block's own `fetchedSize()`. The fallback —
 * `maxv + 65535 - minv` — has to pad by a whole maximum-size BGZF block,
 * because the compressed length of the block at `maxv` is not recorded in the
 * index; it is what this did for every block before the parsers exposed a
 * tightened figure, and it over-estimates.
 *
 * Blocks are also de-duplicated across regions. Two adjacent regions routinely
 * resolve to the same chunk, and it is downloaded once, so counting it twice
 * inflated the estimate for exactly the multi-region queries this gates.
 *
 * Note @gmod/tabix's own `TabixIndexedFile.bytesForRegions` is strictly better
 * still — it runs the chunk merger over the combined set, so it also collapses
 * *overlapping* blocks rather than only identical ones — and every tabix
 * adapter in this repo calls that instead. This remains for other index shapes
 * and for plugins outside the repo, which reach it through `@jbrowse/core/util`.
 */
export async function bytesForRegions(
  regions: Region[],
  index: {
    blocksForRange: (
      ref: string,
      start: number,
      end: number,
    ) => Promise<Block[]>
  },
) {
  const blockResults = await Promise.all(
    regions.map(r => index.blocksForRange(r.refName, r.start, r.end)),
  )
  const seen = new Map<string, Block>()
  for (const block of blockResults.flat()) {
    const { minv, maxv } = block
    seen.set(
      `${minv.blockPosition}:${minv.dataPosition ?? 0}-${maxv.blockPosition}:${maxv.dataPosition ?? 0}`,
      block,
    )
  }
  return sum(
    [...seen.values()].map(block =>
      block.fetchedSize
        ? block.fetchedSize()
        : block.maxv.blockPosition + 65535 - block.minv.blockPosition,
    ),
  )
}
