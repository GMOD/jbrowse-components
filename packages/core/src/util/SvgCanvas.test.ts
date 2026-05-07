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
