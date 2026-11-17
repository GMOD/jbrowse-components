import { findPosInCigar } from './LaunchSyntenyView/findPosInCigar.ts'

interface BpInterval {
  start: number
  end: number
}

/**
 * The position on `mate` that the anchor position `x` maps to, in proportion
 * to `block`, walking the mate from its end on the reverse strand. A
 * zero-length block has no interior to interpolate across, so every `x` lands
 * on the mate's own start (its end, reversed).
 */
export function mateBpAt(
  block: BpInterval,
  mate: BpInterval,
  strand: number | undefined,
  x: number,
) {
  const span = block.end - block.start
  const offset =
    span > 0 ? ((x - block.start) / span) * (mate.end - mate.start) : 0
  return strand !== undefined && strand < 0
    ? mate.end - offset
    : mate.start + offset
}

/**
 * The slices of `block` and its `mate` that the anchor interval [`start`,
 * `end`] cuts: along `ops` where the block carries them, which caps an offset
 * past either end of the block at that end, and in proportion to the block,
 * clamped to it, where not.
 */
export function cutAlignment(
  block: BpInterval,
  mate: BpInterval,
  strand: number | undefined,
  ops: ArrayLike<number> | undefined,
  start: number,
  end: number,
) {
  const mateAt = (offset: number) =>
    strand !== undefined && strand < 0 ? mate.end - offset : mate.start + offset
  const clamp = (x: number) => Math.min(Math.max(x, block.start), block.end)
  const walked = (cigar: ArrayLike<number>, x: number) => {
    const [anchorX, mateX] = findPosInCigar(cigar, x - block.start)
    return { anchor: block.start + anchorX, mate: mateAt(mateX) }
  }
  const interpolated = (x: number) => ({
    anchor: clamp(x),
    mate: mateBpAt(block, mate, strand, clamp(x)),
  })
  const from = ops ? walked(ops, start) : interpolated(start)
  const to = ops ? walked(ops, end) : interpolated(end)
  return {
    anchor: { start: from.anchor, end: to.anchor },
    mate: {
      start: Math.min(from.mate, to.mate),
      end: Math.max(from.mate, to.mate),
    },
  }
}
