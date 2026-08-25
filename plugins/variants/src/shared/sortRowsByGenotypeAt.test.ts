import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

const SOURCES = [{ name: 'S0' }, { name: 'S1' }, { name: 'S2' }]

// The record at 500 and the record at 700 each split the cohort differently,
// so which one the sort anchors on is visible in the order it writes.
function displayWithCells() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources(SOURCES)
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  })
  const genotypeDict = ['0/0', '1/1']
  const codes = (gts: string[]) =>
    new Uint32Array(gts.map(g => genotypeDict.indexOf(g) + 1))
  display.setCellData({
    mode: 'regular',
    sampleNames: ['S0', 'S1', 'S2'],
    genotypeDict,
    simplifiedFeatures: [
      {
        id: 'v500',
        data: { start: 500, end: 501, refName: 'ctgA', name: 'v500' },
      },
      {
        id: 'v700',
        data: { start: 700, end: 701, refName: 'ctgA', name: 'v700' },
      },
    ],
    perRegionCellData: {
      0: {
        featureGenotypeMap: {
          v500: { genotypeCodes: codes(['0/0', '1/1', '0/0']) },
          v700: { genotypeCodes: codes(['1/1', '0/0', '0/0']) },
        },
      },
    },
  } as unknown as Parameters<typeof display.setCellData>[0])
  return display
}

test('anchors the genotype sort on the record covering the column', () => {
  const display = displayWithCells()
  display.sortRowsByGenotypeAt('ctgA', 500)
  // the carrier at 500 is S1
  expect(display.sources[0]!.name).toBe('S1')

  display.sortRowsByGenotypeAt('ctgA', 700)
  expect(display.sources[0]!.name).toBe('S0')
})

test('leaves the rows alone at a column no record covers', () => {
  const display = displayWithCells()
  display.sortRowsByGenotypeAt('ctgA', 600)
  expect(display.layout).toEqual([])
})

// The declarative half: a session names the column and the autorun applies it
// once the region is loaded, then clears the trigger. Awaited, because this
// display installs its autoruns behind a dynamic import.
test('sortRowsBy applies once and clears', async () => {
  const display = displayWithCells()
  display.setSortRowsBy({ refName: 'ctgA', pos: 500 })
  await waitFor(() => {
    expect(display.sortRowsBy).toBeUndefined()
  })
  expect(display.sources[0]!.name).toBe('S1')
})
