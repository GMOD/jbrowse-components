import { measureText as measureTextWidth } from './measureText.ts'

interface SavedState {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  lineCap: CanvasLineCap
  lineJoin: CanvasLineJoin
  lineDash: number[]
  globalCompositeOperation: GlobalCompositeOperation
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
  // Number of `<g clip-path="…">` groups opened since this save() — closed
  // on restore(). Lets clip() be properly scoped to save/restore brackets,
  // matching the CanvasRenderingContext2D semantics.
  groupsToClose: number
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

function escapeXml(s: string) {
  return s.replaceAll(/[&<>"]/g, c => XML_ESCAPES[c]!)
}

// CSS font shorthand is [style] [variant] [weight] [stretch] <size>[/line-height]
// <family>, so the tokens before the size have to be captured too: dropping them
// rendered every `bold Npx ...` label (MAF codons, alignment read labels) at
// regular weight in an SVG export while the canvas drew it bold.
const fontShorthandRe = /^(.*?)(\d+(?:\.\d+)?)px(?:\/\S+)?\s+(.+)$/
const fontWeightTokens = new Set(['bold', 'bolder', 'lighter'])
const fontStyleTokens = new Set(['italic', 'oblique'])

// Parse CSS font shorthand like "10px sans-serif" or "bold 12px monospace" into
// SVG-compatible attributes. The default sans-serif family is left off so
// feature labels match the raw-JSX <text> elements (ruler, scalebar, etc.),
// which set no family either; an explicitly-set family is still emitted.
function fontAttrs(font: string) {
  const m = fontShorthandRe.exec(font)
  if (m) {
    const [, prefix = '', size, family = ''] = m
    const tokens = prefix.split(/\s+/).filter(Boolean)
    const weight = tokens.find(
      t => fontWeightTokens.has(t) || /^\d{1,4}$/.test(t),
    )
    const style = tokens.find(t => fontStyleTokens.has(t))
    return [
      ` font-size="${size}"`,
      family === 'sans-serif' ? '' : ` font-family="${family}"`,
      weight ? ` font-weight="${weight}"` : '',
      style ? ` font-style="${style}"` : '',
    ].join('')
  }
  return ` font-size="${Number.parseFloat(font) || 10}"`
}
let clipIdCounter = 0

export class SvgCanvas {
  private parts: string[] = []
  private pathData = ''
  private stack: SavedState[] = []

  fillStyle: string | CanvasGradient | CanvasPattern = '#000'
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000'
  lineWidth = 1
  font = '10px sans-serif'
  textAlign: CanvasTextAlign = 'start'
  textBaseline: CanvasTextBaseline = 'alphabetic'
  lineCap: CanvasLineCap = 'butt'
  lineJoin: CanvasLineJoin = 'miter'
  globalCompositeOperation: GlobalCompositeOperation = 'source-over'

  private lineDash: number[] = []
  // The CTM, as the SVG `matrix(a b c d e f)` affine:
  //   x' = a*x + c*y + e      y' = b*x + d*y + f
  // A full matrix rather than the separate translate/scale/rotate scalars this
  // used to keep, because those composed in the wrong order: canvas
  // `translate; scale; rotate` means rotate-then-scale (the last call applies
  // first), while the scalars applied scale first. Identical for a uniform
  // scale, but hic's fit-to-height triangle scales y and x differently, so its
  // export came out tilted off the diagonal (proven in
  // plugins/hic/.../svgExportGeometry.test.ts).
  private a = 1
  private b = 0
  private c = 0
  private d = 1
  private e = 0
  private f = 0

  // No rotation/skew term, so a rect stays a rect and `x/y/width/height` can
  // express it. Every caller but hic stays here.
  private get axisAligned() {
    return this.b === 0 && this.c === 0
  }

  private transformPoint(x: number, y: number): [number, number] {
    return [this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f]
  }

  // Axis-aligned only — a rotated CTM shares its width between both axes, and
  // the callers that combine the two emit the matrix instead of pre-sizing.
  private transformSize(w: number, h: number): [number, number] {
    return [w * Math.abs(this.a), h * Math.abs(this.d)]
  }

  // Places a shape's local origin at `x,y` under the current CTM, keeping only
  // the linear part in the matrix. The caller then emits the shape at local
  // 0,0.
  //
  // Folding the origin into the translation this way is what keeps the export's
  // 2-decimal `transform` rounding (wrapSvgExport) harmless: a/b/c/d are
  // unitless multipliers, so rounding them displaces a point in proportion to
  // its coordinate — 0.005 of error across a 1000px layer is 5px. Rounded
  // translations are plain pixels, and the leftover rounding of a/b/c/d then
  // only perturbs the shape's own width and height (sub-0.05px for a bin).
  private originMatrixAttr(x: number, y: number) {
    const { a, b, c, d } = this
    const [tx, ty] = this.transformPoint(x, y)
    return ` transform="matrix(${a} ${b} ${c} ${d} ${tx} ${ty})"`
  }

  // Rects arrive as origin + size, but a negative scale flips which corner the
  // origin lands on: under scale(-1, 1) the local left edge `x` becomes the
  // right edge, so anchoring at transformPoint(x, y) and extending right by
  // `w` covers the neighboring `w` of the canvas — the rect is drawn a full
  // width off. Anchor on whichever corner ends up top-left instead.
  // `transformSize` stays magnitude-only because an SVG width/height can't be
  // negative. A no-op for positive scales (every caller today), which is why
  // this was never noticed.
  //
  // Axis-aligned CTMs only — callers reach this through the `axisAligned`
  // branches, and a rotated/skewed CTM goes through `originMatrixAttr` instead
  // (which handles mirroring for free, since the matrix transforms the rect's
  // own geometry).
  //
  // A negative *size* argument (`fillRect(x, y, -w, h)`, which a real canvas
  // treats as the same rect anchored at `x-w`) is NOT normalized here — SVG
  // would emit `width="-w"` and silently not render. Callers must pass a
  // non-negative size; spans resolve both edges and take
  // `left = min(x1,x2)` / `w = abs(x2-x1)` (see render-core/CLAUDE.md), the
  // same convention that keeps reversed blocks correct.
  private transformRect(x: number, y: number, w: number, h: number) {
    const [tx, ty] = this.transformPoint(
      this.a < 0 ? x + w : x,
      this.d < 0 ? y + h : y,
    )
    const [tw, th] = this.transformSize(w, h)
    return [tx, ty, tw, th] as const
  }

  private textAnchor() {
    return this.textAlign === 'center'
      ? 'middle'
      : this.textAlign === 'right' || this.textAlign === 'end'
        ? 'end'
        : 'start'
  }

  // Split rgba(r,g,b,a) into separate color + opacity SVG attributes for
  // compatibility with SVG 1.1 consumers like Inkscape that don't honor the
  // alpha component of CSS3 rgba() fill/stroke values. Whitespace-tolerant so
  // spaced forms (MUI alpha(), colord toRgbString → "rgba(255, 177, 29, 0.12)")
  // are separated too, not just the compact "rgba(255,177,29,0.12)".
  private paintAttr(
    name: string,
    style: string | CanvasGradient | CanvasPattern,
  ) {
    const s = `${style}`
    const m =
      /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(s)
    if (m) {
      const a = Number.parseFloat(m[4]!)
      const base = `${name}="rgb(${m[1]},${m[2]},${m[3]})"`
      return a < 1 ? `${base} ${name}-opacity="${a}"` : base
    }
    return `${name}="${s}"`
  }

  private strokeAttrs() {
    let attrs = ` ${this.paintAttr('stroke', this.strokeStyle)} stroke-width="${this.lineWidth}"`
    if (this.lineCap !== 'butt') {
      attrs += ` stroke-linecap="${this.lineCap}"`
    }
    if (this.lineJoin !== 'miter') {
      attrs += ` stroke-linejoin="${this.lineJoin}"`
    }
    if (this.lineDash.length > 0) {
      attrs += ` stroke-dasharray="${this.lineDash.join(',')}"`
    }
    return attrs
  }

  save() {
    this.stack.push({
      fillStyle: `${this.fillStyle}`,
      strokeStyle: `${this.strokeStyle}`,
      lineWidth: this.lineWidth,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      lineDash: [...this.lineDash],
      globalCompositeOperation: this.globalCompositeOperation,
      a: this.a,
      b: this.b,
      c: this.c,
      d: this.d,
      e: this.e,
      f: this.f,
      groupsToClose: 0,
    })
  }

  restore() {
    const s = this.stack.pop()
    if (s) {
      for (let i = 0; i < s.groupsToClose; i++) {
        this.parts.push('</g>')
      }
      this.fillStyle = s.fillStyle
      this.strokeStyle = s.strokeStyle
      this.lineWidth = s.lineWidth
      this.font = s.font
      this.textAlign = s.textAlign
      this.textBaseline = s.textBaseline
      this.lineCap = s.lineCap
      this.lineJoin = s.lineJoin
      this.lineDash = s.lineDash
      this.globalCompositeOperation = s.globalCompositeOperation
      this.a = s.a
      this.b = s.b
      this.c = s.c
      this.d = s.d
      this.e = s.e
      this.f = s.f
    }
  }

  // translate/scale/rotate/transform all right-multiply the CTM, matching
  // CanvasRenderingContext2D: the most recently applied transform is the
  // innermost one, so a later call affects the coordinate space of the calls
  // before it and NOT vice versa.
  translate(x: number, y: number) {
    this.e += this.a * x + this.c * y
    this.f += this.b * x + this.d * y
  }

  scale(x: number, y: number) {
    this.a *= x
    this.b *= x
    this.c *= y
    this.d *= y
  }

  rotate(angle: number) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const { a, b, c, d } = this
    this.a = a * cos + c * sin
    this.b = b * cos + d * sin
    this.c = c * cos - a * sin
    this.d = d * cos - b * sin
  }

  resetTransform() {
    this.a = 1
    this.b = 0
    this.c = 0
    this.d = 1
    this.e = 0
    this.f = 0
  }

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) {
    this.a = a
    this.b = b
    this.c = c
    this.d = d
    this.e = e
    this.f = f
  }

  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    const { a: a0, b: b0, c: c0, d: d0 } = this
    this.a = a0 * a + c0 * b
    this.b = b0 * a + d0 * b
    this.c = a0 * c + c0 * d
    this.d = b0 * c + d0 * d
    this.e += a0 * e + c0 * f
    this.f += b0 * e + d0 * f
  }

  setLineDash(segments: number[]) {
    this.lineDash = [...segments]
  }

  getLineDash() {
    return [...this.lineDash]
  }

  fillRect(x: number, y: number, w: number, h: number) {
    if (this.axisAligned) {
      const [tx, ty, tw, th] = this.transformRect(x, y, w, h)
      this.parts.push(
        `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" ${this.paintAttr('fill', this.fillStyle)}/>`,
      )
    } else {
      // Under rotation with a non-uniform scale the rect is a parallelogram, so
      // pre-transformed x/y/width/height can't describe it. Emit the local size
      // and let the matrix place and shear it — exact for any affine, and
      // adjacent rects still share edges (no AA seams between hic bins).
      this.parts.push(
        `<rect width="${w}" height="${h}" ${this.paintAttr('fill', this.fillStyle)}${this.originMatrixAttr(x, y)}/>`,
      )
    }
  }

  clearRect(_x: number, _y: number, _w: number, _h: number) {
    // no-op for SVG
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    if (this.axisAligned) {
      const [tx, ty, tw, th] = this.transformRect(x, y, w, h)
      this.parts.push(
        `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none"${this.strokeAttrs()}/>`,
      )
    } else {
      this.parts.push(
        `<rect width="${w}" height="${h}" fill="none"${this.strokeAttrs()}${this.originMatrixAttr(x, y)}/>`,
      )
    }
  }

  beginPath() {
    this.pathData = ''
  }

  moveTo(x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    this.pathData += `M${tx},${ty}`
  }

  lineTo(x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    this.pathData += `L${tx},${ty}`
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ) {
    const [cx, cy] = this.transformPoint(x, y)
    const [rx, ry] = this.transformSize(radius, radius)
    const sweep = counterclockwise ? 0 : 1
    const diff = endAngle - startAngle

    if (Math.abs(diff) >= 2 * Math.PI) {
      const mx = cx + rx * Math.cos(startAngle)
      const my = cy + ry * Math.sin(startAngle)
      const halfX = cx + rx * Math.cos(startAngle + Math.PI)
      const halfY = cy + ry * Math.sin(startAngle + Math.PI)
      this.pathData += `M${mx},${my}A${rx},${ry} 0 1 ${sweep} ${halfX},${halfY}A${rx},${ry} 0 1 ${sweep} ${mx},${my}`
      return
    }

    const sx = cx + rx * Math.cos(startAngle)
    const sy2 = cy + ry * Math.sin(startAngle)
    const ex = cx + rx * Math.cos(endAngle)
    const ey = cy + ry * Math.sin(endAngle)
    const largeArc = Math.abs(diff) > Math.PI ? 1 : 0

    this.pathData += !this.pathData ? `M${sx},${sy2}` : `L${sx},${sy2}`
    this.pathData += `A${rx},${ry} 0 ${largeArc} ${sweep} ${ex},${ey}`
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) {
    const [tcp1x, tcp1y] = this.transformPoint(cp1x, cp1y)
    const [tcp2x, tcp2y] = this.transformPoint(cp2x, cp2y)
    const [tx, ty] = this.transformPoint(x, y)
    this.pathData += `C${tcp1x},${tcp1y} ${tcp2x},${tcp2y} ${tx},${ty}`
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    const [tcpx, tcpy] = this.transformPoint(cpx, cpy)
    const [tx, ty] = this.transformPoint(x, y)
    this.pathData += `Q${tcpx},${tcpy} ${tx},${ty}`
  }

  rect(x: number, y: number, w: number, h: number) {
    if (this.axisAligned) {
      const [tx, ty, tw, th] = this.transformRect(x, y, w, h)
      this.pathData += `M${tx},${ty}h${tw}v${th}h${-tw}Z`
    } else {
      // Path data carries no transform of its own, so a rotated CTM has to be
      // baked into the four corners.
      const [x0, y0] = this.transformPoint(x, y)
      const [x1, y1] = this.transformPoint(x + w, y)
      const [x2, y2] = this.transformPoint(x + w, y + h)
      const [x3, y3] = this.transformPoint(x, y + h)
      this.pathData += `M${x0},${y0}L${x1},${y1}L${x2},${y2}L${x3},${y3}Z`
    }
  }

  closePath() {
    this.pathData += 'Z'
  }

  stroke() {
    if (this.pathData) {
      this.parts.push(
        `<path d="${this.pathData}" fill="none"${this.strokeAttrs()}/>`,
      )
    }
  }

  fill() {
    if (this.pathData) {
      this.parts.push(
        `<path d="${this.pathData}" ${this.paintAttr('fill', this.fillStyle)} stroke="none"/>`,
      )
    }
  }

  // Shared by fillText and strokeText: the halo pattern draws the same string
  // twice through both, so they must resolve the baseline identically — with
  // strokeText pinned to "auto" a non-alphabetic textBaseline slid the halo off
  // the letters it is meant to back.
  private dominantBaseline() {
    return this.textBaseline === 'middle'
      ? 'middle'
      : this.textBaseline === 'top' || this.textBaseline === 'hanging'
        ? 'hanging'
        : 'auto'
  }

  fillText(text: string, x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const escaped = escapeXml(text)
    this.parts.push(
      `<text x="${tx}" y="${ty}" ${this.paintAttr('fill', this.fillStyle)}${fontAttrs(this.font)} text-anchor="${this.textAnchor()}" dominant-baseline="${this.dominantBaseline()}">${escaped}</text>`,
    )
  }

  strokeText(text: string, x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const escaped = escapeXml(text)
    this.parts.push(
      `<text x="${tx}" y="${ty}" fill="none"${this.strokeAttrs()}${fontAttrs(this.font)} text-anchor="${this.textAnchor()}" dominant-baseline="${this.dominantBaseline()}">${escaped}</text>`,
    )
  }

  drawImage(..._args: unknown[]) {
    // no-op: raster images can't be meaningfully serialized to SVG paths
  }

  putImageData(..._args: unknown[]) {
    // no-op
  }

  clip(..._args: unknown[]) {
    // Use the current path as a clipPath, then open a `<g clip-path>`
    // group that subsequent draws will land inside. The group is closed by
    // restore() — see groupsToClose on the save stack. Without a preceding
    // save() the clip becomes permanent (matches Canvas2D semantics).
    if (!this.pathData) {
      return
    }
    const id = `svgcanvas-clip-${clipIdCounter++}`
    this.parts.push(
      `<clipPath id="${id}"><path d="${this.pathData}"/></clipPath><g clip-path="url(#${id})">`,
    )
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1]!.groupsToClose++
    }
  }

  measureText(text: string) {
    const m = /(\d+(?:\.\d+)?)px/.exec(this.font)
    const fontSize = m ? +m[1]! : Number.parseFloat(this.font) || 10
    return { width: measureTextWidth(text, fontSize) }
  }

  getSerializedSvg() {
    return this.parts.join('')
  }
}
