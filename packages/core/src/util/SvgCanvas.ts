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
  tx: number
  ty: number
  sx: number
  sy: number
  rotation: number
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

// Parse CSS font shorthand like "10px sans-serif" or "bold 12px monospace"
// into SVG-compatible font-size and font-family attributes. The default
// sans-serif family is left off so feature labels match the raw-JSX <text>
// elements (ruler, scalebar, etc.), which set no family either; an
// explicitly-set family (e.g. monospace) is still emitted.
function fontAttrs(font: string) {
  const m = /(\d+(?:\.\d+)?)px\s+(.+)/.exec(font)
  if (m) {
    const family = m[2] === 'sans-serif' ? '' : ` font-family="${m[2]}"`
    return ` font-size="${m[1]}"${family}`
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
  private tx = 0
  private ty = 0
  private sx = 1
  private sy = 1
  private rotation = 0

  private transformPoint(x: number, y: number): [number, number] {
    const sx = x * this.sx
    const sy = y * this.sy
    if (this.rotation === 0) {
      return [sx + this.tx, sy + this.ty]
    }
    const cos = Math.cos(this.rotation)
    const sin = Math.sin(this.rotation)
    return [sx * cos - sy * sin + this.tx, sx * sin + sy * cos + this.ty]
  }

  private transformSize(w: number, h: number): [number, number] {
    return [w * Math.abs(this.sx), h * Math.abs(this.sy)]
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
  // A negative *size* argument (`fillRect(x, y, -w, h)`, which a real canvas
  // treats as the same rect anchored at `x-w`) is NOT normalized here — SVG
  // would emit `width="-w"` and silently not render. Callers must pass a
  // non-negative size; spans resolve both edges and take
  // `left = min(x1,x2)` / `w = abs(x2-x1)` (see render-core/CLAUDE.md), the
  // same convention that keeps reversed blocks correct.
  private transformRect(x: number, y: number, w: number, h: number) {
    const [tx, ty] = this.transformPoint(
      this.sx < 0 ? x + w : x,
      this.sy < 0 ? y + h : y,
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
      tx: this.tx,
      ty: this.ty,
      sx: this.sx,
      sy: this.sy,
      rotation: this.rotation,
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
      this.tx = s.tx
      this.ty = s.ty
      this.sx = s.sx
      this.sy = s.sy
      this.rotation = s.rotation
    }
  }

  translate(x: number, y: number) {
    if (this.rotation === 0) {
      this.tx += x * this.sx
      this.ty += y * this.sy
    } else {
      const cos = Math.cos(this.rotation)
      const sin = Math.sin(this.rotation)
      const dx = x * this.sx
      const dy = y * this.sy
      this.tx += dx * cos - dy * sin
      this.ty += dx * sin + dy * cos
    }
  }

  scale(x: number, y: number) {
    this.sx *= x
    this.sy *= y
  }

  rotate(angle: number) {
    this.rotation += angle
  }

  resetTransform() {
    this.tx = 0
    this.ty = 0
    this.sx = 1
    this.sy = 1
    this.rotation = 0
  }

  setTransform(
    a: number,
    b: number,
    _c: number,
    d: number,
    e: number,
    f: number,
  ) {
    this.sx = a
    this.sy = d
    this.rotation = Math.atan2(b, a)
    this.tx = e
    this.ty = f
  }

  transform(
    _a: number,
    _b: number,
    _c: number,
    _d: number,
    _e: number,
    _f: number,
  ) {
    // simplified: only commonly used via save/translate/scale/rotate
  }

  setLineDash(segments: number[]) {
    this.lineDash = [...segments]
  }

  getLineDash() {
    return [...this.lineDash]
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const [tx, ty, tw, th] = this.transformRect(x, y, w, h)
    if (this.rotation !== 0 && this.rotation % (Math.PI / 2) !== 0) {
      const deg = (this.rotation * 180) / Math.PI
      this.parts.push(
        `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" ${this.paintAttr('fill', this.fillStyle)} transform="rotate(${deg} ${tx} ${ty})"/>`,
      )
    } else {
      this.parts.push(
        `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" ${this.paintAttr('fill', this.fillStyle)}/>`,
      )
    }
  }

  clearRect(_x: number, _y: number, _w: number, _h: number) {
    // no-op for SVG
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    const [tx, ty, tw, th] = this.transformRect(x, y, w, h)
    this.parts.push(
      `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none"${this.strokeAttrs()}/>`,
    )
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
    const [tx, ty, tw, th] = this.transformRect(x, y, w, h)
    this.pathData += `M${tx},${ty}h${tw}v${th}h${-tw}Z`
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

  fillText(text: string, x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const anchor = this.textAnchor()
    const baseline =
      this.textBaseline === 'middle'
        ? 'middle'
        : this.textBaseline === 'top' || this.textBaseline === 'hanging'
          ? 'hanging'
          : 'auto'
    const escaped = escapeXml(text)
    this.parts.push(
      `<text x="${tx}" y="${ty}" ${this.paintAttr('fill', this.fillStyle)}${fontAttrs(this.font)} text-anchor="${anchor}" dominant-baseline="${baseline}">${escaped}</text>`,
    )
  }

  strokeText(text: string, x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const anchor = this.textAnchor()
    const escaped = escapeXml(text)
    this.parts.push(
      `<text x="${tx}" y="${ty}" fill="none"${this.strokeAttrs()}${fontAttrs(this.font)} text-anchor="${anchor}">${escaped}</text>`,
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
