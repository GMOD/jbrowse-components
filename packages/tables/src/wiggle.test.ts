import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'

import { createTablesEngine } from './index.ts'
import {
  COVERAGE_BIGWIG,
  MULTI_BIGWIG,
  SIGNED_BIGWIG,
} from './volvox.fixture.ts'

const engine = createTablesEngine()

test('a BigWig region comes back as the wiggle display scales and colors it', async () => {
  const t = await engine.wiggle(SIGNED_BIGWIG)
  const n = t.bins.start.length
  expect(n).toBeGreaterThan(100)
  for (const table of [t.bins, t.marks]) {
    expect(new Set(Object.values(table).map(c => c.length)).size).toBe(1)
  }
  expect(t.rendering).toBe('xyplot')
  expect(t.marks.start).toHaveLength(n)
  const pos = new Set<string>()
  const neg = new Set<string>()
  t.marks.score.forEach((score, i) => {
    ;(score < 0 ? neg : pos).add(t.marks.color[i]!)
    expect(t.marks.low[i]).toBe(0)
  })
  expect(pos.size).toBe(1)
  expect(neg.size).toBe(1)
  expect(pos).not.toEqual(neg)
  const [lo, hi] = t.domain
  expect(lo).toBeLessThanOrEqual(Math.min(...t.bins.score))
  expect(hi).toBeGreaterThanOrEqual(Math.max(...t.bins.score))

  const pinned = await engine.wiggle({
    ...SIGNED_BIGWIG,
    display: { encoding: { y: { scale: { domainMin: -50, domainMax: 300 } } } },
  })
  expect(pinned.domain).toEqual([-50, 300])

  const ruled = await engine.wiggle({
    ...SIGNED_BIGWIG,
    display: {
      encoding: {
        y: {
          rules: [{ value: 0 }, { value: 500, color: 'red', label: 'gain' }],
        },
      },
    },
  })
  expect(ruled.rules).toEqual({
    value: [0, 500],
    color: ['#787878', '#ff0000'],
    label: ['', 'gain'],
  })
})

test('a zoomed-out min-max extent draws the max and min bands around the mean', async () => {
  const wide = { ...COVERAGE_BIGWIG, bpPerPx: 1000 }
  const plain = await engine.wiggle({ ...wide, display: { extent: 'none' } })
  expect(new Set(plain.marks.layer).size).toBe(1)
  const t = await engine.wiggle({ ...wide, display: { extent: 'min-max' } })
  expect(new Set(t.marks.layer).size).toBe(3)
  t.bins.score.forEach((score, i) => {
    expect(t.bins.min[i]).toBeLessThanOrEqual(score)
    expect(t.bins.max[i]).toBeGreaterThanOrEqual(score)
  })
  expect(t.bins.max.some((max, i) => max > t.bins.score[i]!)).toBe(true)
  expect(new Set(t.marks.color).size).toBe(3)
  expect(t.domain[1]).toBeGreaterThanOrEqual(Math.max(...t.bins.max))

  const max = await engine.wiggle({
    ...wide,
    display: { y: 'maxScore', extent: 'none' },
  })
  expect(max.marks.score).toEqual(t.bins.max)

  const line = await engine.wiggle({
    ...wide,
    display: { mark: 'line', extent: 'min-max' },
  })
  const band = line.marks.band.map((b, i) => i).filter(i => line.marks.band[i])
  expect(band).toHaveLength(line.bins.start.length)
  for (const i of band) {
    expect(line.marks.low[i]).toBeLessThanOrEqual(line.marks.score[i]!)
    expect(line.marks.opacity[i]).toBeGreaterThan(0)
    expect(line.marks.opacity[i]).toBeLessThan(1)
  }
  expect(
    new Set(line.marks.opacity.filter((_, i) => !line.marks.band[i])),
  ).toEqual(new Set([1]))
})

test('density fades each bin from white at the origin to the side it is on', async () => {
  const t = await engine.wiggle({ ...SIGNED_BIGWIG, display: { mark: 'rect' } })
  expect(t.rendering).toBe('density')
  const lightness = (hex: string) =>
    Math.min(...[1, 3, 5].map(k => Number.parseInt(hex.slice(k, k + 2), 16)))
  for (const side of [1, -1]) {
    const byMagnitude = t.marks.score
      .map((score, i) => ({ score, light: lightness(t.marks.color[i]!) }))
      .filter(m => Math.sign(m.score) === side)
      .sort((a, b) => Math.abs(a.score) - Math.abs(b.score))
    expect(byMagnitude.length).toBeGreaterThan(10)
    for (let i = 1; i < byMagnitude.length; i++) {
      expect(byMagnitude[i]!.light).toBeLessThanOrEqual(
        byMagnitude[i - 1]!.light,
      )
    }
    expect(byMagnitude[0]!.light).toBeGreaterThan(byMagnitude.at(-1)!.light)
  }
  expect(new Set(t.marks.color).size).toBeGreaterThan(20)
})

test('density keys its ramp as the display does, and a bar plot keys none', async () => {
  const t = await engine.wiggle({ ...SIGNED_BIGWIG, display: { mark: 'rect' } })
  expect(t.ramps).toHaveLength(1)
  const [ramp] = t.ramps
  expect(ramp!.title).toBe('Score')
  expect([ramp!.minLabel, ramp!.maxLabel]).toEqual(t.domain.map(String))
  expect(ramp!.offset[0]).toBe(0)
  expect(ramp!.offset.at(-1)).toBe(1)
  expect(ramp!.color).toHaveLength(ramp!.offset.length)
  expect(new Set(ramp!.color).size).toBeGreaterThan(8)

  expect((await engine.wiggle(SIGNED_BIGWIG)).ramps).toEqual([])
})

test('a line takes the color of the band between the cuts its score is in', async () => {
  const encoding = {
    color: {
      scale: {
        type: 'threshold',
        domain: [-200, 200],
        range: ['blue', 'grey', 'red'],
      },
    },
  }
  const bandOf = (score: number) =>
    score < -200 ? '#0000ff' : score < 200 ? '#808080' : '#ff0000'
  for (const mark of ['bar', 'line']) {
    const t = await engine.wiggle({
      ...SIGNED_BIGWIG,
      bpPerPx: 1000,
      display: { mark, encoding, extent: 'none' },
    })
    t.marks.score.forEach((score, i) => {
      if (!t.marks.band[i]) {
        expect(t.marks.color[i]).toBe(bandOf(score))
      }
    })
    expect(new Set(t.marks.color).size).toBe(3)
  }
  const line = await engine.wiggle({
    ...SIGNED_BIGWIG,
    bpPerPx: 1000,
    display: { mark: 'line', encoding },
  })
  const pieces = line.marks.band
    .map((b, i) => i)
    .filter(i => line.marks.band[i])
  expect(pieces.length).toBeGreaterThan(line.bins.score.length)
  for (const i of pieces) {
    expect(bandOf(line.marks.low[i]!)).toBe(line.marks.color[i])
    expect(line.marks.low[i]).toBeLessThanOrEqual(line.marks.score[i]!)
  }
})

test('a multi-wiggle stacks its sources in the order rows.sort gives', async () => {
  const domain = ['posneg_rw3', 'posneg_rw1', 'posneg_rw2']
  const t = await engine.wiggle({
    ...MULTI_BIGWIG,
    display: { rows: { field: 'source', sort: domain } },
  })
  expect(t.sources.name).toEqual(domain)
  expect([...new Set(t.bins.source)]).toEqual(domain)
  domain.forEach((name, row) => {
    const rows = t.marks.row.filter((_, i) => t.marks.source[i] === name)
    expect(rows.length).toBeGreaterThan(0)
    expect(new Set(rows)).toEqual(new Set([row]))
  })
  const shared = await engine.wiggle({
    ...MULTI_BIGWIG,
    display: { rows: { field: '' } },
  })
  expect(new Set(shared.marks.row)).toEqual(new Set([0]))
  expect(new Set(shared.marks.source).size).toBe(3)
})

test('a multi-wiggle reads under the multi-track defaults: a row per source, no min-max extent', async () => {
  const zoomedOut = { ...MULTI_BIGWIG, bpPerPx: 500 }
  const t = await engine.wiggle(zoomedOut)
  expect(t.rowLayout).toBe(true)
  expect(t.height).toBe(200)
  expect(t.marks.band.some(Boolean)).toBe(false)
  expect(t.marks.start).toHaveLength(t.bins.start.length)
  const single = await engine.wiggle({
    ...zoomedOut,
    trackType: 'QuantitativeTrack',
  })
  expect(single.rowLayout).toBe(false)
  expect(single.marks.start.length).toBeGreaterThan(t.marks.start.length)
})

describe('sources sharing one panel take the colors the display deals them', () => {
  // the cases rowPalette.test.ts pins on the display model
  const SHARED = { rows: { field: '' } }
  const colorsOf = async (display: Record<string, unknown>) => {
    const t = await engine.wiggle({
      ...MULTI_BIGWIG,
      display: { ...SHARED, ...display },
    })
    const painted = t.sources.name.map(name => [
      ...new Set(t.marks.color.filter((_, i) => t.marks.source[i] === name)),
    ])
    return { declared: t.sources.color, painted }
  }

  it('deals each source a tableau10 color, painted on both sides of the cut', async () => {
    const tableau = [0, 1, 2].map(i => cssColorToHex(rowPaletteColorAt(i)))
    const { declared, painted } = await colorsOf({})
    expect(declared).toEqual(tableau)
    expect(painted).toEqual(tableau.map(c => [c]))
  })

  it('deals in the sources’ own order, so a reorder recolors nothing', async () => {
    const plain = await colorsOf({})
    const colorOf = new Map(
      plain.painted.map((c, i) => [`posneg_rw${i + 1}`, c]),
    )
    const domain = ['posneg_rw3', 'posneg_rw1', 'posneg_rw2']
    const reordered = await colorsOf({ rows: { field: '', sort: domain } })
    expect(reordered.painted).toEqual(domain.map(name => colorOf.get(name)))
  })

  it("greys the sources rowColor's pairs leave out under its unknown", async () => {
    const { declared } = await colorsOf({
      rowColor: {
        scale: {
          domain: ['posneg_rw2'],
          range: ['#123456'],
          unknown: '#cccccc',
        },
      },
    })
    expect(declared).toEqual(['#cccccc', '#123456', '#cccccc'])
  })

  it('deals nothing under None, nor over a declared color, nor while a gradient paints', async () => {
    for (const display of [
      { rowColor: { scale: { unknown: '' } } },
      { encoding: { color: { value: 'darkgreen' } } },
      { mark: 'rect' },
    ]) {
      expect((await colorsOf(display)).declared).toEqual(['', '', ''])
    }
  })
})

test('an interpolated line breaks into runs where the display breaks it', async () => {
  const line = (maxGapMultiple: number) =>
    engine.wiggle({
      ...COVERAGE_BIGWIG,
      bpPerPx: 5,
      display: {
        mark: { type: 'line', interpolate: 'linear' },
        extent: 'none',
        maxGapMultiple,
      },
    })
  const broken = await line(1)
  const runs = new Set(broken.marks.run)
  expect(runs.size).toBeGreaterThan(1)
  expect(runs.size).toBeLessThan(broken.marks.run.length)
  const mid = (i: number) => (broken.marks.start[i]! + broken.marks.end[i]!) / 2
  const gaps = broken.marks.run
    .map((r, i) => i)
    .filter(i => i > 0 && broken.marks.run[i] !== broken.marks.run[i - 1])
    .map(i => mid(i) - mid(i - 1))
  const links = broken.marks.run
    .map((r, i) => i)
    .filter(i => i > 0 && broken.marks.run[i] === broken.marks.run[i - 1])
    .map(i => mid(i) - mid(i - 1))
  expect(Math.min(...gaps)).toBeGreaterThan(Math.max(...links))
  expect(new Set((await line(0)).marks.run).size).toBe(1)
})

describe('several regions share the one domain the display autoscales to', () => {
  const low = { refName: 'ctgA', start: 0, end: 10000 }
  const high = { refName: 'ctgA', start: 20000, end: 30000 }
  const read = (
    regions: { refName: string; start: number; end: number }[],
    display: Record<string, unknown> = {},
  ) =>
    engine.wiggle({
      adapterConfig: SIGNED_BIGWIG.adapterConfig,
      regions,
      bpPerPx: 25,
      display,
    })

  it('colors a score alike in every region, against one ramp', async () => {
    const density = { mark: 'rect' }
    const [alone, both] = await Promise.all([
      Promise.all([read([low], density), read([high], density)]),
      read([low, high], density),
    ])
    expect(alone[0].domain).not.toEqual(alone[1].domain)
    const scores = [...alone[0].bins.score, ...alone[1].bins.score]
    expect(both.domain[0]).toBeLessThanOrEqual(Math.min(...scores))
    expect(both.domain[1]).toBeGreaterThanOrEqual(Math.max(...scores))
    const colorOf = new Map<number, Set<string>>()
    both.marks.score.forEach((score, i) => {
      colorOf.set(
        score,
        (colorOf.get(score) ?? new Set()).add(both.marks.color[i]!),
      )
    })
    const shared = both.marks.score.filter(
      (score, i) =>
        both.marks.region[i] === 0 &&
        both.marks.score.some(
          (s, j) => s === score && both.marks.region[j] === 1,
        ),
    )
    expect(shared.length).toBeGreaterThan(0)
    for (const score of shared) {
      expect(colorOf.get(score)!.size).toBe(1)
    }
    expect(both.ramps).toHaveLength(1)
  })

  it('names each mark and bin by its region, and breaks a line between them', async () => {
    const t = await read([low, high], { mark: 'line' })
    for (const table of [t.marks, t.bins]) {
      expect(new Set(table.region)).toEqual(new Set([0, 1]))
      table.start.forEach((start, i) => {
        const r = [low, high][table.region[i]!]!
        expect(start).toBeLessThan(r.end)
        expect(table.end[i]).toBeGreaterThan(r.start)
      })
    }
    const regionsOfRun = new Map<number, Set<number>>()
    t.marks.run.forEach((run, i) => {
      regionsOfRun.set(
        run,
        (regionsOfRun.get(run) ?? new Set()).add(t.marks.region[i]!),
      )
    })
    for (const regions of regionsOfRun.values()) {
      expect(regions.size).toBe(1)
    }
  })

  it('reads one region alike as region or regions', async () => {
    const { region, ...rest } = SIGNED_BIGWIG
    expect(await engine.wiggle({ ...rest, regions: [region] })).toEqual(
      await engine.wiggle(SIGNED_BIGWIG),
    )
  })

  it('names the missing contig of each region', async () => {
    const t = await read([low, { ...high, refName: 'chrNope' }])
    expect(t.missingContigs[0]).toBe('')
    expect(t.missingContigs[1]).toMatch(/^chrNope is not a contig/)
    expect(t.missingContig).toBe(t.missingContigs[1])
  })
})
