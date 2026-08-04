import { setConf } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import Flatbush from '@jbrowse/core/util/flatbush'

import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

// The legend has to name the insertion marker, because the number in it is the
// part a reader cannot decode: a review of `pangenome/maf` reported the glyph as
// "the text like 5593". The section is conditional on the display actually
// drawing markers, so both halves of that condition are pinned here.

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
        cellCarriesAlt: Uint8Array.from([1]),
        cellFeatureIndices: new Uint32Array(1),
        numCells: 1,
        refCellCount: 0,
        featureGenotypeMap: {},
        featureIdList: ['v0'],
        featurePositions: Uint32Array.from([100, 200]),
        featureIndexData: featureIndexData(),
        featureInsertedBp: Int32Array.from([insertedBp]),
      },
    },
  }
}

function sectionIds(insertedBp: number, showInsertionGlyphs = true) {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, 'showInsertionGlyphs', showInsertionGlyphs)
  display.setCellData(cellData(insertedBp))
  return display.legendSections().map(s => s.id)
}

test('a window with an insertion gets the marker section', () => {
  expect(sectionIds(7833)).toEqual(['genotypes', 'insertions'])
})

// Not a claim about the data, a claim about the glyph: a SNP panel draws no
// marker, so advertising one would describe something not on screen.
test('a window with no insertion does not', () => {
  expect(sectionIds(0)).toEqual(['genotypes'])
})

test('the slot turned off suppresses it even where an insertion is present', () => {
  expect(sectionIds(7833, false)).toEqual(['genotypes'])
})

// The swatch must be the color the overlay paints, or the legend teaches the
// reader the wrong thing to look for. Both read palette.insertion.
test('the swatch is the palette color the overlay paints with', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setCellData(cellData(7833))
  const section = display.legendSections().find(s => s.id === 'insertions')
  expect(section!.items).toEqual([
    {
      color: resolvePalette().insertion,
      label: 'Insertion (label is length in bp)',
    },
  ])
})
