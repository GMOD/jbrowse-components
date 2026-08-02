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
