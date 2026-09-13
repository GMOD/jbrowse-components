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
 * The mate interval the anchor interval [`start`, `end`] maps to, ordered and
 * rounded to whole bp.
 */
export function mateSlice(
  block: BpInterval,
  mate: BpInterval,
  strand: number | undefined,
  start: number,
  end: number,
): BpInterval {
  const a = mateBpAt(block, mate, strand, start)
  const b = mateBpAt(block, mate, strand, end)
  return { start: Math.round(Math.min(a, b)), end: Math.round(Math.max(a, b)) }
}
