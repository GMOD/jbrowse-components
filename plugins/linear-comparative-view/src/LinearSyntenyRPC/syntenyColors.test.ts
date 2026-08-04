import { colorSchemes } from '@jbrowse/synteny-core'

import {
  KIND_BASE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
  computeSyntenyColors,
} from './syntenyColors.ts'

const TRACK_COLOR = '#4e79a7'

// two features, then one instance of each kind pointing at feature 0
const featureData = {
  strands: new Int8Array([1, -1]),
  refNames: ['chr1', 'chr2'],
  mateRefNames: ['chrA', 'chrB'],
  identities: new Float32Array([0.9, 0.5]),
  mappingQuals: new Float32Array([60, 10]),
  meanIdentities: new Float32Array([0.9, 0.5]),
}

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
          featureData: {
            strands: new Int8Array([1]),
            refNames: [name],
            mateRefNames: [name],
            identities: new Float32Array([-1]),
            mappingQuals: new Float32Array([-1]),
            meanIdentities: new Float32Array([-1]),
          },
          colorBy: 'query',
          trackColor: '#000',
          nameOrder,
        })[0]!,
    )

  test('twelve chromosomes get twelve colors', () => {
    expect(new Set(colorsFor(chromosomes)).size).toBe(12)
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
// chromosomes. An even spread over the circle divides by that 30 and paints
// every chromosome inside the first 132 degrees, which is one wash rather than
// twelve colors — the stride does not care how long the tail of scaffolds is.
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
        featureData: {
          strands: new Int8Array([1]),
          refNames: [name],
          mateRefNames: [name],
          identities: new Float32Array([-1]),
          mappingQuals: new Float32Array([-1]),
          meanIdentities: new Float32Array([-1]),
        },
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
