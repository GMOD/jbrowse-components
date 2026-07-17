import { SvgCanvas } from './SvgCanvas.ts'

test('clip + restore brackets a group, scoping draws to the clip path', () => {
  const ctx = new SvgCanvas()

  ctx.fillStyle = 'red'
  ctx.fillRect(0, 0, 5, 5)

  ctx.save()
  ctx.beginPath()
  ctx.rect(10, 0, 20, 100)
  ctx.clip()
  ctx.fillStyle = 'blue'
  ctx.fillRect(15, 5, 10, 10)
  ctx.restore()

  ctx.fillStyle = 'green'
  ctx.fillRect(50, 50, 5, 5)

  const svg = ctx.getSerializedSvg()

  expect(svg).toContain('<clipPath id="svgcanvas-clip-0">')
  expect(svg).toContain('<g clip-path="url(#svgcanvas-clip-0)">')
  expect(svg).toContain('</g>')

  const blueIdx = svg.indexOf('fill="blue"')
  const greenIdx = svg.indexOf('fill="green"')
  const closeIdx = svg.indexOf('</g>')

  expect(blueIdx).toBeLessThan(closeIdx)
  expect(greenIdx).toBeGreaterThan(closeIdx)
})

test('nested clips emit nested groups and close in reverse order', () => {
  const ctx = new SvgCanvas()

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, 100, 100)
  ctx.clip()

  ctx.save()
  ctx.beginPath()
  ctx.rect(10, 10, 50, 50)
  ctx.clip()
  ctx.fillRect(20, 20, 5, 5)
  ctx.restore()

  ctx.fillRect(70, 70, 5, 5)
  ctx.restore()

  const svg = ctx.getSerializedSvg()
  const opens = (svg.match(/<g clip-path/g) ?? []).length
  const closes = (svg.match(/<\/g>/g) ?? []).length
  expect(opens).toBe(2)
  expect(closes).toBe(2)
})

test('clip with no preceding path is a no-op', () => {
  const ctx = new SvgCanvas()
  ctx.save()
  ctx.clip()
  ctx.fillRect(0, 0, 10, 10)
  ctx.restore()

  const svg = ctx.getSerializedSvg()
  expect(svg).not.toContain('<clipPath')
  expect(svg).not.toContain('clip-path')
})

test('rgba fill is split into fill + fill-opacity for SVG 1.1 compat', () => {
  const ctx = new SvgCanvas()

  ctx.fillStyle = 'rgba(255,0,0,0.2)'
  ctx.beginPath()
  ctx.rect(0, 0, 10, 10)
  ctx.fill()
  ctx.fillRect(20, 0, 10, 10)

  ctx.fillStyle = 'rgba(0,128,0,1)'
  ctx.fillRect(40, 0, 10, 10)

  const svg = ctx.getSerializedSvg()

  expect(svg).not.toContain('rgba(')
  expect(svg).toContain('fill="rgb(255,0,0)" fill-opacity="0.2"')
  expect(svg).toContain('fill="rgb(0,128,0)"')
  expect(svg).not.toContain('fill-opacity="1"')
})

test('spaced rgba (MUI alpha / colord) is split too, not emitted raw', () => {
  const ctx = new SvgCanvas()

  ctx.fillStyle = 'rgba(255, 177, 29, 0.12)'
  ctx.fillRect(0, 0, 10, 10)
  ctx.strokeStyle = 'rgba(255, 177, 29, 0.7)'
  ctx.strokeRect(0, 0, 10, 10)

  const svg = ctx.getSerializedSvg()

  expect(svg).not.toContain('rgba(')
  expect(svg).toContain('fill="rgb(255,177,29)" fill-opacity="0.12"')
  expect(svg).toContain('stroke="rgb(255,177,29)"')
  expect(svg).toContain('stroke-opacity="0.7"')
})

// A rect is given as origin + size, so a negative scale flips which corner the
// origin lands on. Getting this wrong emits the rect one full width away —
// silently, and only for the caller that mirrors. Nothing in-tree scales
// negatively today, which is exactly why this needs pinning: the trap is set
// for the first caller that tries (e.g. mirroring a reversed genomic region
// instead of baking the flip into every bp→px call).
describe('negative scale', () => {
  test('fillRect mirrors onto the same pixels a real canvas would cover', () => {
    const ctx = new SvgCanvas()
    // Mirror about x=100: local [10,15] must land on screen [85,90].
    ctx.translate(100, 0)
    ctx.scale(-1, 1)
    ctx.fillStyle = 'red'
    ctx.fillRect(10, 0, 5, 20)

    expect(ctx.getSerializedSvg()).toContain(
      'x="85" y="0" width="5" height="20"',
    )
  })

  test('strokeRect mirrors the same way', () => {
    const ctx = new SvgCanvas()
    ctx.translate(100, 0)
    ctx.scale(-1, 1)
    ctx.strokeRect(10, 0, 5, 20)

    expect(ctx.getSerializedSvg()).toContain(
      'x="85" y="0" width="5" height="20"',
    )
  })

  test('a mirrored rect abuts its neighbor with no gap or overlap', () => {
    // Two abutting cells, [10,15] and [15,20], must stay abutting once
    // mirrored — the property that breaks when the origin corner is wrong.
    const ctx = new SvgCanvas()
    ctx.translate(100, 0)
    ctx.scale(-1, 1)
    ctx.fillRect(10, 0, 5, 1)
    ctx.fillRect(15, 0, 5, 1)

    const svg = ctx.getSerializedSvg()
    expect(svg).toContain('x="85"')
    expect(svg).toContain('x="80"')
  })

  test('scale(1,-1) flips the vertical origin corner too', () => {
    const ctx = new SvgCanvas()
    ctx.translate(0, 100)
    ctx.scale(1, -1)
    ctx.fillRect(0, 10, 20, 5)

    expect(ctx.getSerializedSvg()).toContain(
      'x="0" y="85" width="20" height="5"',
    )
  })

  test('positive scales are untouched', () => {
    const ctx = new SvgCanvas()
    ctx.scale(2, 2)
    ctx.fillRect(10, 5, 3, 4)

    expect(ctx.getSerializedSvg()).toContain(
      'x="20" y="10" width="6" height="8"',
    )
  })
})
