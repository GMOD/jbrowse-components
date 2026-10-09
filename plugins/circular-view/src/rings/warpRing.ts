const TWO_PI = 2 * Math.PI

/**
 * How far round the circle a point `dx`/`dy` from its centre (screen frame,
 * y down) sits past `offsetRadians`, in `[0, 2π)`: the angle a slice's
 * `startRadians` counts, with the figure's rotation taken out.
 */
export function turnAt(dx: number, dy: number, offsetRadians: number) {
  const a = Math.atan2(dy, dx) - offsetRadians
  return a - Math.floor(a / TWO_PI) * TWO_PI
}

/** RGBA pixels, unpremultiplied, as `ImageData` holds them. */
export interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** A ring's place in a `Pixels`, in its px. */
export interface Annulus {
  centerX: number
  centerY: number
  innerPx: number
  outerPx: number
  /** where strip x = 0 sits, in radians clockwise from the +x axis */
  offsetRadians: number
}

/**
 * `ringWarp.slang`'s fragment on the CPU, for the Canvas2D painter and the SVG
 * export. Each pixel of the annulus samples `strip` at its turn round the
 * circle and its depth below the outer rim, filtered bilinearly over the
 * premultiplied strip with its edges clamped as the GPU sampler's are, and
 * both rims fade over a pixel. A pixel the ring leaves transparent keeps what
 * it held.
 *
 * Per pixel rather than as rotated slices of strip (ADR-119): slices are
 * rectangles, so neighbours overlap at their seams and more toward the inner
 * rim, and a 50% strip composited twice there drew at up to 75%, in stripes.
 */
export function warpRing(out: Pixels, strip: Pixels, ring: Annulus) {
  const { centerX: cx, centerY: cy, innerPx: inner, outerPx: outer } = ring
  const band = outer - inner
  if (band <= 0) {
    return
  }
  const { data: src, width: sw, height: sh } = strip
  const { data: dst, width: w, height: h } = out
  const uScale = sw / TWO_PI
  const vScale = sh / band
  const lo = Math.max(0, inner - 0.5)
  const hi = outer + 0.5
  const yEnd = Math.min(h, Math.ceil(cy + hi))
  for (let y = Math.max(0, Math.floor(cy - hi)); y < yEnd; y++) {
    const dy = y + 0.5 - cy
    const dy2 = dy * dy
    const reach2 = hi * hi - dy2
    if (reach2 <= 0) {
      continue
    }
    const reach = Math.sqrt(reach2)
    const xEnd = Math.min(w, Math.ceil(cx + reach - 0.5) + 1)
    // the run of pixels whose centres sit inside the inner rim's fade
    let holeStart = xEnd
    let holeEnd = xEnd
    const hole2 = lo * lo - dy2
    if (hole2 > 0) {
      const hole = Math.sqrt(hole2)
      holeStart = Math.ceil(cx - hole - 0.5)
      holeEnd = Math.floor(cx + hole - 0.5) + 1
    }
    for (let x = Math.max(0, Math.floor(cx - reach - 0.5)); x < xEnd; x++) {
      if (x === holeStart && holeEnd > holeStart) {
        x = holeEnd - 1
        continue
      }
      const dx = x + 0.5 - cx
      const r = Math.sqrt(dx * dx + dy2)
      const outerFade = outer - r + 0.5
      const innerFade = r - inner + 0.5
      if (outerFade <= 0 || innerFade <= 0) {
        continue
      }
      const u = turnAt(dx, dy, ring.offsetRadians) * uScale - 0.5
      const v = (outer - r) * vScale - 0.5
      const ui = Math.floor(u)
      const vi = Math.floor(v)
      const fu = u - ui
      const fv = v - vi
      const u0 = clampIndex(ui, sw)
      const u1 = clampIndex(ui + 1, sw)
      const row0 = clampIndex(vi, sh) * sw
      const row1 = clampIndex(vi + 1, sh) * sw
      const p00 = (row0 + u0) * 4
      const p10 = (row0 + u1) * 4
      const p01 = (row1 + u0) * 4
      const p11 = (row1 + u1) * 4
      const w00 = (1 - fu) * (1 - fv) * src[p00 + 3]!
      const w10 = fu * (1 - fv) * src[p10 + 3]!
      const w01 = (1 - fu) * fv * src[p01 + 3]!
      const w11 = fu * fv * src[p11 + 3]!
      const alpha = w00 + w10 + w01 + w11
      if (alpha > 0) {
        const o = (y * w + x) * 4
        const inv = 1 / alpha
        dst[o] =
          (w00 * src[p00]! +
            w10 * src[p10]! +
            w01 * src[p01]! +
            w11 * src[p11]!) *
          inv
        dst[o + 1] =
          (w00 * src[p00 + 1]! +
            w10 * src[p10 + 1]! +
            w01 * src[p01 + 1]! +
            w11 * src[p11 + 1]!) *
          inv
        dst[o + 2] =
          (w00 * src[p00 + 2]! +
            w10 * src[p10 + 2]! +
            w01 * src[p01 + 2]! +
            w11 * src[p11 + 2]!) *
          inv
        dst[o + 3] = alpha * Math.min(1, outerFade) * Math.min(1, innerFade)
      }
    }
  }
}

function clampIndex(i: number, n: number) {
  return i < 0 ? 0 : i >= n ? n - 1 : i
}
