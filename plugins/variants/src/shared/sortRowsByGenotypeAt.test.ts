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

// The shared gate only knows a region covers the column; the record it needs is
// this display's own extra condition, so the decline has to be reported or the
// autorun clears a trigger that never sorted anything.
test('reports whether a record answered the column', () => {
  const display = displayWithCells()
  expect(display.sortRowsByGenotypeAt('ctgA', 600)).toBe(false)
  expect(display.sortRowsByGenotypeAt('ctgA', 500)).toBe(true)
})

test('sortRowsBy at a bare column waits for a record there', async () => {
  const display = displayWithCells()
  // A first spec the records answer, awaited so the autorun — installed behind
  // a dynamic import — is running before the one that declines is written
  display.setSortRowsBy({ refName: 'ctgA', pos: 500 })
  await waitFor(() => {
    expect(display.sortRowsBy).toBeUndefined()
  })

  display.setSortRowsBy({ refName: 'ctgA', pos: 600 })
  expect(display.sortRowsBy).toEqual({ refName: 'ctgA', pos: 600 })

  // the record at 600 arrives with a later fetch; the carrier there is S2
  const genotypeDict = ['0/0', '1/1']
  display.setCellData({
    mode: 'regular',
    sampleNames: ['S0', 'S1', 'S2'],
    genotypeDict,
    simplifiedFeatures: [
      {
        id: 'v600',
        data: { start: 600, end: 601, refName: 'ctgA', name: 'v600' },
      },
    ],
    perRegionCellData: {
      0: {
        featureGenotypeMap: {
          v600: { genotypeCodes: new Uint32Array([1, 1, 2]) },
        },
      },
    },
  } as unknown as Parameters<typeof display.setCellData>[0])
  // the commit that lands with it — what the autorun watches, since the action
  // it dispatches into reads `cellData` untracked
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 1000,
    assemblyName: 'volvox',
  })
  await waitFor(() => {
    expect(display.sortRowsBy).toBeUndefined()
  })
  expect(display.sources[0]!.name).toBe('S2')
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
