import { LONG_INSERTION_MIN_LENGTH } from '@jbrowse/alignments-core'
import { setConf } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import Flatbush from '@jbrowse/core/util/flatbush'

import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

// The legend has to name the insertion marker, because the number in it is the
// part a reader cannot decode: a review of `pangenome/maf` reported the glyph as
// "the text like 5593".
//
// The section is conditional on the display actually DRAWING a marker -- the
// painter's own test, not a proxy for it. Every positive case zooms in first,
// because at the harness's default 12,500 bp/px even a 7.8 kb insertion draws
// nothing.

function featureIndexData() {
  const index = new Flatbush(1, 16, Uint32Array)
  index.add(100, 0, 200, 1)
  index.finish()
  return index.data
}

// One variant, one sample, `insertedBp` bases inserted (0 = a SNP, which can
// never produce a marker).
function cellData(insertedBp: number): CellDataResult {
  return {
    mode: 'regular',
    sampleInfo: { S0: { maxPloidy: 2, isPhased: false } },
    rowNames: ['S0'],
    hasPhased: false,
    hasPhasedOrHaploid: false,
    hasSecondaryAlt: false,
    hasUnphased: false,
    hasNoCall: false,
    hasConsequence: false,
    hasSvType: false,
    hasPhaseSet: false,
    svTypeColors: {},
    simplifiedFeatures: [
      { id: 'v0', data: { start: 100, end: 200, refName: 'ctgA', name: 'v0' } },
    ],
    genotypeDict: ['0|1'],
    sampleNames: ['S0'],
    perRegionCellData: {
      0: {
        cellPositions: Uint32Array.from([100, 200]),
        cellRowIndices: Uint32Array.from([0]),
        cellColors: Uint32Array.from([0xff0000]),
        cellShapeTypes: new Uint8Array(1),
        cellAltDosage: Uint8Array.from([1]),
        cellFeatureIndices: new Uint32Array(1),
        numCells: 1,
        refCellCount: 0,
        featureGenotypeMap: {},
        featureIdList: ['v0'],
        featurePositions: Uint32Array.from([100, 200]),
        featureIndexData: featureIndexData(),
        featureInsertedBp: Int32Array.from([insertedBp]),
        featureColors: Uint32Array.from([0xff00ff00]),
      },
    },
  }
}

// bpPerPx 100: a >=10bp insertion whose bar reaches the count-label box (34px)
// beats the 2px cell floor, so it draws.
function setup(insertedBp: number, showInsertionGlyphs = true, bpPerPx = 100) {
  const { display, view } = createTestEnvironment().createDisplay()
  view.zoomTo(bpPerPx)
  setConf(display, 'showInsertionGlyphs', showInsertionGlyphs)
  display.setCellData(cellData(insertedBp))
  return display
}

function sectionIds(
  insertedBp: number,
  showInsertionGlyphs = true,
  bpPerPx = 100,
) {
  return setup(insertedBp, showInsertionGlyphs, bpPerPx)
    .legendSections()
    .map(s => s.id)
}

test('a window with an insertion gets the marker section', () => {
  expect(sectionIds(7833)).toEqual(['genotypes', 'insertions'])
})

// Not a claim about the data, a claim about the glyph: a SNP panel draws no
// marker, so advertising one would describe something not on screen.
test('a window with no insertion does not', () => {
  expect(sectionIds(0)).toEqual(['genotypes'])
})

// Both cheaper proxies for "is a marker drawn" were tried and both put a swatch
// on figures that draw nothing.
//
// "The window holds an insertion" fails on short ones: insertionBarWidth returns
// 1px below LONG_INSERTION_MIN_LENGTH, which never beats the 2px cell floor at
// ANY zoom, so an ordinary short-indel callset has an insertion in every window
// and a marker in none.
test('a short insertion, which can never draw a marker, does not', () => {
  expect(sectionIds(LONG_INSERTION_MIN_LENGTH - 1)).toEqual(['genotypes'])
})

// "The window holds a LONG insertion" fails zoomed out, where even a long bar
// falls under the cell floor. This was three of the fourteen committed figures
// carrying this display, each gaining one 576px swatch and no glyph.
test('a long insertion too zoomed out to draw one does not', () => {
  expect(sectionIds(7833, true, 12500)).toEqual(['genotypes'])
  expect(sectionIds(7833, true, 100)).toEqual(['genotypes', 'insertions'])
})

test('the slot turned off suppresses it even where an insertion is present', () => {
  expect(sectionIds(7833, false)).toEqual(['genotypes'])
})

// The swatch must be the color the overlay paints, or the legend teaches the
// reader the wrong thing to look for. Both read palette.insertion.
test('the swatch is the palette color the overlay paints with', () => {
  const section = setup(7833)
    .legendSections()
    .find(s => s.id === 'insertions')
  expect(section!.items[0]!.color).toBe(resolvePalette().insertion)
})
