/**
 * Packed ABGR → `rgba(...)`, and the run-tracking fill a painter wraps it in.
 *
 * A local twin of `@jbrowse/core/util/colorBits`'s `abgrToCssRgba` /
 * `setAbgrFill`, on the `useEventCallback` precedent: render-core does not
 * depend on `@jbrowse/core`, and the direction that genuinely needs it is the
 * other one — resolving a CSS colour to a packed number needs core's parser,
 * which is why a shape takes packed colours and the display resolves them.
 */
export function abgrToCssRgba(c: number) {
  const a = ((c >>> 24) & 255) / 255
  return `rgba(${c & 255},${(c >>> 8) & 255},${(c >>> 16) & 255},${a})`
}

/**
 * A fill-style setter that only touches `ctx.fillStyle` when the colour
 * changes. Most of a painting is runs of one colour, and both the string
 * allocation and the context write cost more than the comparison.
 */
export function makeAbgrFill(ctx: {
  fillStyle: string | CanvasGradient | CanvasPattern
}) {
  let last: number | undefined
  return (abgr: number) => {
    if (abgr !== last) {
      last = abgr
      ctx.fillStyle = abgrToCssRgba(abgr)
    }
  }
}
