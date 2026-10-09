import { elideRegions, elisionMask, fitLayout, ringAt } from './fitLayout.ts'
import {
  assemblyBandPx,
  labelOffsetPx,
  labelWidthPx,
  maxLabelGutterPx,
  regionLabelText,
} from './rulerLabels.ts'
import { GENOME_GAP_UNITS, gapUnitsAfter } from './slices.ts'

import type { FitInput } from './fitLayout.ts'
import type { Region } from '@jbrowse/core/util'

function region(refName: string, end: number, assemblyName = 'hg') {
  return { refName, start: 0, end, assemblyName }
}

function input(regions: Region[], box = 800): FitInput {
  return {
    regions,
    width: box,
    height: box,
    spacingPx: 10,
    paddingPx: 80,
    minVisibleWidth: 6,
    minimumRadiusPx: 25,
  }
}

// what the view draws at the fitted scale
function drawn(fit: ReturnType<typeof fitLayout>, regions: Region[]) {
  const elided = elideRegions(regions, elisionMask(regions, fit.bpPerPx!, 6))
  const units = gapUnitsAfter(elided).reduce((a, b) => a + b, 0)
  const basesPx = elided.reduce((sum, r) => sum + r.widthBp / fit.bpPerPx!, 0)
  const { spacingPx } = ringAt(basesPx, units, 10)
  return { elided, units, spacingPx, ringPx: basesPx + units * spacingPx }
}

const chromosomes = Array.from({ length: 24 }, (_, i) =>
  region(`chr${i + 1}`, 250_000_000 - i * 8_000_000),
)

test('the fit closes the ring on the radius the box leaves', () => {
  const fit = fitLayout(input(chromosomes))
  expect(fit.radiusPx).toBeCloseTo(400 - fit.paddingPx, 6)
  expect(drawn(fit, chromosomes).ringPx).toBeCloseTo(
    2 * Math.PI * fit.radiusPx,
    9,
  )
})

test('a lone circular sequence closes the ring, and a lone linear one keeps its gap', () => {
  const linear = elideRegions([region('chr1', 16_569)], '0')
  const circular = elideRegions(
    [{ ...region('chrM', 16_569), circular: true }],
    '0',
  )
  expect(gapUnitsAfter(linear)).toEqual([1])
  expect(gapUnitsAfter(circular)).toEqual([0])
  expect(
    gapUnitsAfter(
      elideRegions(
        [{ ...region('chrM', 16_569), circular: true }, region('chr1', 9)],
        '00',
      ),
    ),
  ).toEqual([1, 1])
})

// hg19's unplaced contigs carry the circle's longest names and all elide into
// one run at the fit. Measuring the padding before the fit, when nothing is
// elided yet, sized the SKBR3 circle for `chrUn_gl000211` and drew it 40px
// smaller than it needed to be
test('a name elided at the fit takes no room', () => {
  const contigs = Array.from({ length: 60 }, (_, i) =>
    region(`chrUn_gl0002${String(i).padStart(2, '0')}`, 40_000),
  )
  const regions = [...chromosomes, ...contigs]
  const fit = fitLayout(input(regions))
  const { elided } = drawn(fit, regions)
  expect(elided).toHaveLength(25)
  expect(fit.paddingPx).toBeLessThan(
    labelOffsetPx + labelWidthPx('chrUn_gl000200'),
  )
})

test("a second genome's names and its gaps are both counted", () => {
  const mouse = chromosomes.map(r => ({ ...r, assemblyName: 'mm' }))
  const regions = [...chromosomes, ...mouse]
  const fit = fitLayout(input(regions))
  const { units } = drawn(fit, regions)
  expect(units).toBe(regions.length + 2 * (GENOME_GAP_UNITS - 1))
  expect(fit.paddingPx).toBe(
    maxLabelGutterPx([...regions.map(r => r.refName), `[${regions.length}]`]) +
      assemblyBandPx,
  )
})

// Two long names draw at a first guess of the radius and elide into `[2]` at
// the circle the box leaves once they are paid for. The circle is as large as
// it can be with them elided: at the scale where they just are, padded for the
// labels drawn there
test('the padding holds the labels drawn at the fit and no more', () => {
  const regions = [
    ...Array.from({ length: 20 }, (_, i) => region(`chr${i + 1}`, 100_000_000)),
    region('verylongcontigname_1', 12_000_000),
    region('verylongcontigname_2', 12_000_000),
  ]
  const fit = fitLayout(input(regions, 600))
  expect(drawn(fit, regions).elided.map(regionLabelText)).toContain('[2]')
  expect(fit.bpPerPx).toBeCloseTo(12_000_000 / 6, -1)
  expect(fit.paddingPx).toBe(
    maxLabelGutterPx(drawn(fit, regions).elided.map(regionLabelText)),
  )
})

// a seeded sweep over region sets whose elision lands anywhere, including on a
// gap-count jump: the ring never overflows the box, and the padding is what the
// labels drawn at the fit reach, between the box's share and its cap
test('the fit never overflows the box or clips a label below the cap', () => {
  let seed = 7
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
    return seed / 2 ** 31
  }
  for (let trial = 0; trial < 300; trial++) {
    const assemblies = random() < 0.5 ? ['a'] : ['a', 'b']
    const regions = assemblies.flatMap(assemblyName =>
      Array.from({ length: 1 + Math.floor(random() * 60) }, (_, i) =>
        region(
          'x'.repeat(1 + Math.floor(random() * 16)) + i,
          Math.ceil(10 ** (3 + random() * 6)),
          assemblyName,
        ),
      ),
    )
    const box = 150 + Math.floor(random() * 900)
    const fit = fitLayout(input(regions, box))
    const { elided, ringPx } = drawn(fit, regions)
    expect(ringPx).toBeLessThanOrEqual(2 * Math.PI * fit.radiusPx * (1 + 1e-9))
    // a lone region is titled in the middle, leaving the ticks alone outside
    const reach =
      maxLabelGutterPx(regions.length > 1 ? elided.map(regionLabelText) : []) +
      (assemblies.length > 1 ? assemblyBandPx : 0)
    const boxShare = Math.min(80, Math.max(20, box / 10))
    expect(fit.paddingPx).toBeCloseTo(
      Math.max(boxShare, Math.min(reach, box / 4)),
      9,
    )
    expect(fit.radiusPx + fit.paddingPx).toBeLessThanOrEqual(box / 2 + 1e-9)
  }
})

test('no bases, no scale', () => {
  expect(fitLayout(input([])).bpPerPx).toBeUndefined()
})
