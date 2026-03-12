interface SavedState {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  globalAlpha: number
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
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export class SvgCanvas {
  private parts: string[] = []
  private pathData = ''
  private stack: SavedState[] = []

  fillStyle: string | CanvasGradient | CanvasPattern = '#000'
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000'
  lineWidth = 1
  globalAlpha = 1
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

  private alphaAttr() {
    return this.globalAlpha < 1 ? ` opacity="${this.globalAlpha}"` : ''
  }

  private strokeAttrs() {
    let attrs = ` stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"`
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
      globalAlpha: this.globalAlpha,
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
    })
  }

  restore() {
    const s = this.stack.pop()
    if (s) {
      this.fillStyle = s.fillStyle
      this.strokeStyle = s.strokeStyle
      this.lineWidth = s.lineWidth
      this.globalAlpha = s.globalAlpha
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
    c: number,
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
    const [tx, ty] = this.transformPoint(x, y)
    const [tw, th] = this.transformSize(w, h)
    const alpha = this.alphaAttr()
    if (this.rotation !== 0 && this.rotation % (Math.PI / 2) !== 0) {
      const deg = (this.rotation * 180) / Math.PI
      this.parts.push(
        `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="${this.fillStyle}"${alpha} transform="rotate(${deg} ${tx} ${ty})"/>`,
      )
    } else {
      this.parts.push(
        `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="${this.fillStyle}"${alpha}/>`,
      )
    }
  }

  clearRect(_x: number, _y: number, _w: number, _h: number) {
    // no-op for SVG
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const [tw, th] = this.transformSize(w, h)
    const alpha = this.alphaAttr()
    this.parts.push(
      `<rect x="${tx}" y="${ty}" width="${tw}" height="${th}" fill="none"${this.strokeAttrs()}${alpha}/>`,
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
    const [tx, ty] = this.transformPoint(x, y)
    const [tw, th] = this.transformSize(w, h)
    this.pathData += `M${tx},${ty}h${tw}v${th}h${-tw}Z`
  }

  closePath() {
    this.pathData += 'Z'
  }

  stroke() {
    if (this.pathData) {
      const alpha = this.alphaAttr()
      this.parts.push(
        `<path d="${this.pathData}" fill="none"${this.strokeAttrs()}${alpha}/>`,
      )
    }
  }

  fill() {
    if (this.pathData) {
      const alpha = this.alphaAttr()
      this.parts.push(
        `<path d="${this.pathData}" fill="${this.fillStyle}" stroke="none"${alpha}/>`,
      )
    }
  }

  fillText(text: string, x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const alpha = this.alphaAttr()
    const anchor =
      this.textAlign === 'center'
        ? 'middle'
        : this.textAlign === 'right' || this.textAlign === 'end'
          ? 'end'
          : 'start'
    const baseline =
      this.textBaseline === 'middle'
        ? 'middle'
        : this.textBaseline === 'top' || this.textBaseline === 'hanging'
          ? 'hanging'
          : 'auto'
    const escaped = escapeXml(text)
    this.parts.push(
      `<text x="${tx}" y="${ty}" fill="${this.fillStyle}" font="${this.font}" text-anchor="${anchor}" dominant-baseline="${baseline}"${alpha}>${escaped}</text>`,
    )
  }

  strokeText(text: string, x: number, y: number) {
    const [tx, ty] = this.transformPoint(x, y)
    const alpha = this.alphaAttr()
    const anchor =
      this.textAlign === 'center'
        ? 'middle'
        : this.textAlign === 'right' || this.textAlign === 'end'
          ? 'end'
          : 'start'
    const escaped = escapeXml(text)
    this.parts.push(
      `<text x="${tx}" y="${ty}" fill="none"${this.strokeAttrs()} font="${this.font}" text-anchor="${anchor}"${alpha}>${escaped}</text>`,
    )
  }

  drawImage(..._args: unknown[]) {
    // no-op: raster images can't be meaningfully serialized to SVG paths
  }

  putImageData(..._args: unknown[]) {
    // no-op
  }

  clip(..._args: unknown[]) {
    // no-op: clipping is handled at the SVG wrapper level
  }

  measureText(text: string) {
    const fontSize = Number.parseFloat(this.font) || 10
    return { width: text.length * fontSize * 0.6 }
  }

  getSerializedSvg() {
    return this.parts.join('')
  }
}
