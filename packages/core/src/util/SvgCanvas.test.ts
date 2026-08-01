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

// The CTM composes like CanvasRenderingContext2D's: the last transform call
// applies to the point first. Only hic rotates today, and it is also the only
// caller whose scale is non-uniform — the combination where the composition
// order is observable at all.
describe('rotation', () => {
  // The rect is emitted at local 0,0, so the matrix' translation IS where its
  // origin corner lands.
  function corner(svg: string) {
    const m = /matrix\(([^)]*)\)/.exec(svg)![1]!.split(' ').map(Number)
    return [m[4]!, m[5]!]
  }

  test('scale applies to the rotated point, not the other way round', () => {
    const ctx = new SvgCanvas()
    ctx.scale(1, 2)
    ctx.rotate(-Math.PI / 4)
    ctx.fillRect(100, 100, 10, 10)

    // (100,100) rotates onto the x-axis, so doubling y must leave it there.
    const [x, y] = corner(ctx.getSerializedSvg())
    expect(x).toBeCloseTo(Math.SQRT2 * 100, 6)
    expect(y).toBeCloseTo(0, 6)
  })

  test('translate after rotate moves along the rotated axes', () => {
    const ctx = new SvgCanvas()
    ctx.rotate(-Math.PI / 2)
    ctx.translate(10, 0)
    ctx.fillRect(0, 0, 1, 1)

    const [x, y] = corner(ctx.getSerializedSvg())
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(-10, 6)
  })

  test('a right-angle rotation is carried, not dropped', () => {
    const ctx = new SvgCanvas()
    ctx.rotate(Math.PI / 2)
    ctx.fillRect(0, 0, 4, 2)

    // Exact multiples of 90° used to take the unrotated branch, emitting a
    // 4x2 rect where a 2x4 one belongs.
    const svg = ctx.getSerializedSvg()
    expect(svg).toContain('width="4" height="2"')
    expect(svg).toContain('matrix(')
  })
})

describe('text baseline', () => {
  // The halo pattern (drawPeptides) draws one string through strokeText then
  // fillText. strokeText used to pin dominant-baseline="auto" while fillText
  // honored textBaseline, so any non-alphabetic baseline slid the halo off the
  // letters it backs.
  test('strokeText and fillText resolve the same baseline', () => {
    const ctx = new SvgCanvas()
    ctx.textBaseline = 'middle'
    ctx.strokeText('A', 0, 0)
    ctx.fillText('A', 0, 0)

    const baselines = [
      ...ctx.getSerializedSvg().matchAll(/dominant-baseline="([^"]*)"/g),
    ].map(m => m[1])
    expect(baselines).toEqual(['middle', 'middle'])
  })

  test('the default alphabetic baseline emits auto', () => {
    const ctx = new SvgCanvas()
    ctx.strokeText('A', 0, 0)
    expect(ctx.getSerializedSvg()).toContain('dominant-baseline="auto"')
  })
})

describe('font shorthand', () => {
  // Regression: the size/family regex matched mid-string, so the weight and
  // style tokens ahead of the size were dropped and every `bold Npx ...` label
  // (MAF codons, alignment read labels) exported at regular weight.
  test.each([
    ['10px sans-serif', ' font-size="10"'],
    ['bold 12px sans-serif', ' font-size="12" font-weight="bold"'],
    [
      'bold 10px Courier New,monospace',
      ' font-size="10" font-family="Courier New,monospace" font-weight="bold"',
    ],
    [
      'italic 12px serif',
      ' font-size="12" font-family="serif" font-style="italic"',
    ],
    [
      'italic 600 12px serif',
      ' font-size="12" font-family="serif" font-weight="600" font-style="italic"',
    ],
    ['12px/1.5 sans-serif', ' font-size="12"'],
  ])('%p emits %p', (font, expected) => {
    const ctx = new SvgCanvas()
    ctx.font = font
    ctx.fillText('A', 0, 0)
    const emitted = ctx.getSerializedSvg().match(/font-\w+="[^"]*"/g)
    expect(emitted?.join(' ')).toBe(expected.trim())
  })
})

describe('ellipse', () => {
  // The arc endpoints come out of trig, so they carry ~1e-15 of noise that has
  // always been there (`arc` produced it too). Round it off rather than pin it.
  const pathOf = (ctx: SvgCanvas) =>
    /d="([^"]*)"/
      .exec(ctx.getSerializedSvg())?.[1]
      ?.replaceAll(/-?\d+\.?\d*(?:e[+-]\d+)?/g, m =>
        String(Number(Number(m).toFixed(6))),
      )

  // Paired-read arcs stroke a half ellipse; SVG's arc command takes separate
  // radii natively, so the export is the same curve rather than a flattening of
  // it. `arc` delegates here, hence the equal-radii case.
  test('a half ellipse emits one arc command between its two endpoints', () => {
    const ctx = new SvgCanvas()
    ctx.beginPath()
    ctx.ellipse(100, 50, 40, 10, 0, Math.PI, 2 * Math.PI)
    ctx.stroke()
    expect(pathOf(ctx)).toBe('M60,50A40,10 0 0 1 140,50')
  })

  test('arc still emits equal radii', () => {
    const ctx = new SvgCanvas()
    ctx.beginPath()
    ctx.arc(100, 50, 40, Math.PI, 2 * Math.PI)
    ctx.stroke()
    expect(pathOf(ctx)).toBe('M60,50A40,40 0 0 1 140,50')
  })

  // Canvas measures the angle on the unrotated ellipse and spins the result, so
  // the endpoint is the parametric point rotated — not the point at
  // (angle + rotation), which for a non-circular ellipse is a different place.
  test('rotation turns the endpoints, not the angles', () => {
    const ctx = new SvgCanvas()
    ctx.beginPath()
    ctx.ellipse(0, 0, 40, 10, Math.PI / 2, 0, Math.PI)
    ctx.stroke()
    expect(pathOf(ctx)).toBe('M0,40A40,10 90 0 1 0,-40')
  })

  test('a closed ellipse goes round in two halves', () => {
    const ctx = new SvgCanvas()
    ctx.beginPath()
    ctx.ellipse(0, 0, 40, 10, 0, 0, 2 * Math.PI)
    ctx.stroke()
    expect(pathOf(ctx)).toBe('M40,0A40,10 0 1 1 -40,0A40,10 0 1 1 40,0')
  })
})
