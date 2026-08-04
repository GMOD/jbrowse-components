import { LONG_INSERTION_MIN_LENGTH } from '@jbrowse/alignments-core'
import { setConf } from '@jbrowse/core/configuration'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import Flatbush from '@jbrowse/core/util/flatbush'

import configFactory from './configSchema.ts'
import stateModelFactory from './model.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

// The legend has to name the insertion marker, because the number in it is the
// part a reader cannot decode: a review of `pangenome/maf` reported the glyph as
// "the text like 5593".
//
// The section is conditional on the window holding an insertion long enough to
// produce a marker, which is not the same as holding an insertion at all.

const configSchema = configFactory()

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

function setup(insertedBp: number, showInsertionGlyphs = true) {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display, 'showInsertionGlyphs', showInsertionGlyphs)
  display.setCellData(cellData(insertedBp))
  return display
}

function sectionIds(insertedBp: number, showInsertionGlyphs = true) {
  return setup(insertedBp, showInsertionGlyphs)
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

// The case that made "does the window hold an insertion" the wrong gate, and it
// is the common one rather than a corner: insertionBarWidth returns 1px below
// LONG_INSERTION_MIN_LENGTH, which never beats the 2px cell floor at ANY zoom.
// A callset of ordinary short indels therefore has an insertion in every window
// and a marker in none, and the first cut of this legend put an "Insertions"
// swatch on three figures that draw nothing.
test('a short insertion, which can never draw a marker, does not', () => {
  expect(sectionIds(LONG_INSERTION_MIN_LENGTH - 1)).toEqual(['genotypes'])
  expect(sectionIds(LONG_INSERTION_MIN_LENGTH)).toEqual([
    'genotypes',
    'insertions',
  ])
})

// The gate must not need the containing view: legendSections is reachable from
// a display mounted standalone, which is how the SVG export overlay is tested
// (SvgVariantOverlay.test.tsx). Reading renderBlocks/renderState here threw
// "no containing view found" there.
test('answers without a containing view', () => {
  const model = stateModelFactory(configSchema).create({
    type: 'LinearMultiSampleVariantDisplay',
    configuration: configSchema.create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'no-view',
    }),
  })
  expect(() => model.legendSections()).not.toThrow()
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
  expect(section!.items).toEqual([
    {
      color: resolvePalette().insertion,
      label: 'Insertion (label is length in bp)',
    },
  ])
})
