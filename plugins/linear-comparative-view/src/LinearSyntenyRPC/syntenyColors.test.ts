import { category10 } from '@jbrowse/core/ui/colors'
import { abgrAlpha } from '@jbrowse/core/util/colorBits'
import { colorSchemes } from '@jbrowse/synteny-core'

import { isInstanceInvisible } from '../LinearSyntenyDisplay/syntenyRibbonPath.ts'
import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
  KIND_MARKER,
  computeSyntenyColors,
} from './syntenyColors.ts'

const TRACK_COLOR = '#4e79a7'

// One feature per refName, with the attribute channels this suite is about
// substituted over the packer's empty ones.
function features(
  blocks: { refName: string; mateRefName: string; strand?: number }[],
  attributes: Record<string, Float32Array> = {},
) {
  return {
    ...packSyntenyFeatureData(
      blocks.map(b => ({ ...b, start: 0, end: 1, mateStart: 0, mateEnd: 1 })),
    ),
    attributes,
  }
}

// two features, then one instance of each kind pointing at feature 0
const featureData = features(
  [
    { refName: 'chr1', mateRefName: 'chrA', strand: 1 },
    { refName: 'chr2', mateRefName: 'chrB', strand: -1 },
  ],
  {
    identity: new Float32Array([0.9, 0.5]),
    mappingQual: new Float32Array([60, 10]),
    meanIdentity: new Float32Array([0.9, 0.5]),
    dnds: new Float32Array([-1]),
  },
)

const instanceData = {
  kinds: new Uint8Array([KIND_BASE, KIND_CIGAR_I, KIND_CIGAR_D, KIND_CIGAR_N]),
  instanceFeatureIdx: new Uint32Array([0, 0, 0, 0]),
  instanceCount: 4,
}

function abgrOfHex(hex: string) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

describe("computeSyntenyColors colorBy:'track'", () => {
  const colors = computeSyntenyColors({
    instanceData,
    featureData,
    colorBy: 'track',
    trackColor: TRACK_COLOR,
  })

  test('base instances take the track color', () => {
    expect(colors[0]).toBe(abgrOfHex(TRACK_COLOR))
  })

  // The point of the mode is telling tracks apart at a glance, but an
  // insertion still has to read as an insertion — only 'strand' recolors the
  // indel ops, so 'track' inherits the default I/D/N palette like query/target
  // already do.
  test('CIGAR indel instances keep their own colors', () => {
    const { cigarColors } = colorSchemes.default
    expect(colors[1]).toBe(abgrOfHex('#ffff00')) // I, '#ff0'
    expect(colors[2]).toBe(abgrOfHex('#0000ff')) // D, '#00f'
    expect(colors[3]).not.toBe(abgrOfHex(TRACK_COLOR)) // N
    expect(cigarColors.I).toBe('#ff0')
  })

  test('every base instance of the track is the same color', () => {
    const twoFeatures = computeSyntenyColors({
      instanceData: {
        kinds: new Uint8Array([KIND_BASE, KIND_BASE]),
        instanceFeatureIdx: new Uint32Array([0, 1]),
        instanceCount: 2,
      },
      featureData,
      colorBy: 'track',
      trackColor: TRACK_COLOR,
    })
    // opposite strands, different refNames, different identity — still flat
    expect(twoFeatures[0]).toBe(twoFeatures[1])
  })

  test('a different track color paints differently', () => {
    const other = computeSyntenyColors({
      instanceData,
      featureData,
      colorBy: 'track',
      trackColor: '#f28e2c',
    })
    expect(other[0]).not.toBe(colors[0])
  })
})

// The location-marker toggle is a COLOR decision, which is what keeps it out of
// `currentFetchKey`: the worker emits every tick unconditionally, and "off" is a
// zero alpha written here. Ticking the checkbox used to re-download and re-parse
// the whole track to arrive at the identical features.
describe('the location-marker toggle', () => {
  const markerData = {
    kinds: new Uint8Array([KIND_BASE, KIND_MARKER]),
    instanceFeatureIdx: new Uint32Array([0, 0]),
    instanceCount: 2,
  }
  const paint = (drawLocationMarkers?: boolean) =>
    computeSyntenyColors({
      instanceData: markerData,
      featureData,
      colorBy: 'track',
      trackColor: TRACK_COLOR,
      drawLocationMarkers,
    })

  test('on: a tick is the fixed semi-transparent black, whatever colorBy says', () => {
    const on = paint(true)
    expect(abgrAlpha(on[1]!)).toBe(64)
    expect(
      computeSyntenyColors({
        instanceData: markerData,
        featureData,
        colorBy: 'strand',
        trackColor: TRACK_COLOR,
        drawLocationMarkers: true,
      })[1],
    ).toBe(on[1])
  })

  test('off: a tick is transparent, and nothing else moves', () => {
    const off = paint(false)
    expect(abgrAlpha(off[1]!)).toBe(0)
    // below the floor the draw loop and the pick engine share, so the instance
    // is skipped outright rather than blended
    expect(isInstanceInvisible(off[1]!)).toBe(true)
    expect(off[0]).toBe(paint(true)[0]!)
  })

  test('omitted reads as off, so a caller that forgets cannot paint a grid', () => {
    expect(paint(undefined)[1]).toBe(paint(false)[1])
  })
})

// Chromosome painting used to bucket a refName into nine category10 slots, so a
// genome with ten or more chromosomes re-used colors — twelve rice chromosomes
// is a guaranteed three-way collision, which is what a figure review saw. Given
// the assembly's own chromosome order there is a color per chromosome.
describe('chromosome painting', () => {
  const chromosomes = Array.from({ length: 12 }, (_, i) => `chr${i + 1}`)
  const colorsFor = (nameOrder?: readonly string[]) =>
    chromosomes.map(
      name =>
        computeSyntenyColors({
          instanceData: {
            kinds: new Uint8Array([KIND_BASE]),
            instanceFeatureIdx: new Uint32Array([0]),
            instanceCount: 1,
          },
          featureData: features([{ refName: name, mateRefName: name }]),
          colorBy: 'query',
          trackColor: '#000',
          nameOrder,
        })[0]!,
    )

  test('twelve chromosomes get twelve colors', () => {
    expect(new Set(colorsFor(chromosomes)).size).toBe(12)
  })

  // The colors are category10's, not a ramp's: an even hue circle at one
  // saturation is collision-free too and was rejected by figure review as a
  // rainbow. The first lap is the palette untouched.
  test('the first nine are the palette itself', () => {
    const palette = category10.filter(hex => hex.toLowerCase() !== '#7f7f7f')
    expect(colorsFor(chromosomes).slice(0, 9)).toEqual(
      palette.map(hex => abgrOfHex(hex)),
    )
  })

  // Nine colors, more than nine chromosomes: a lap re-lights the same hue
  // rather than repeating it, so chr10 is a deep chr1 and not a second chr1.
  test('a lap re-lights the palette instead of repeating it', () => {
    const colors = colorsFor(chromosomes)
    expect(colors[9]).not.toBe(colors[0])
    // same hue, darker: every channel of the deep lap is below the base blue's
    const [base, lap] = [colors[0]!, colors[9]!]
    for (const shift of [0, 8, 16]) {
      expect((lap >>> shift) & 0xff).toBeLessThan((base >>> shift) & 0xff)
    }
  })

  test('a chromosome the order does not list still gets a color', () => {
    // an alias, a scaffold, or an assembly still loading: the hash fallback
    expect(colorsFor(['chrZ'])).toHaveLength(12)
    expect(colorsFor(['chrZ']).every(c => c !== 0)).toBe(true)
  })

  // The defect, kept as a test so the fallback is not silently made the default
  // again: without an order, nine slots hold twelve names.
  test('without an order the hash re-uses colors', () => {
    expect(new Set(colorsFor()).size).toBeLessThan(12)
  })
})

// A refName list is not a chromosome list: rice's has 30 entries for 12
// chromosomes, two organelles and sixteen scaffolds. So a position picks a
// palette entry rather than a fraction of the list — spreading N colors over
// those 30 entries painted all twelve chromosomes inside one eighth of the
// range, which is a wash rather than twelve colors.
test('scaffolds after the chromosomes do not compress the palette', () => {
  const chromosomes = Array.from({ length: 12 }, (_, i) => `chr${i + 1}`)
  const withScaffolds = [
    ...chromosomes,
    ...Array.from({ length: 18 }, (_, i) => `scaffold${i}`),
  ]
  const hues = chromosomes.map(
    name =>
      computeSyntenyColors({
        instanceData: {
          kinds: new Uint8Array([KIND_BASE]),
          instanceFeatureIdx: new Uint32Array([0]),
          instanceCount: 1,
        },
        featureData: features([{ refName: name, mateRefName: name }]),
        colorBy: 'query',
        trackColor: '#000',
        nameOrder: withScaffolds,
      })[0]!,
  )
  expect(new Set(hues).size).toBe(12)
  // packed ABGR: the blue byte is the high one. A ramp that never leaves
  // red-through-green leaves it at zero for every chromosome.
  expect(hues.some(c => (c >>> 16) & 0xff)).toBe(true)
})
