import {
  cellDataOf,
  cellPayloadOf,
  featureInfoOf,
} from '../shared/cellDataFixtures.ts'
import { variantRowsSurface } from './components/VariantComponent.tsx'
import { variantMatrixSurface } from './matrix/VariantMatrixComponent.tsx'
import { createTestEnvironment } from './testEnv.ts'

const ROW_NAMES = ['S0', 'S1']

// Two 4kb records over two samples, every cell called, so a cell sits under
// every pixel of an 800px view of 8kb in either layout.
function cellData() {
  return cellDataOf({
    rowNames: ROW_NAMES,
    simplifiedFeatures: [0, 4000].map((start, i) => ({
      id: `v${i}`,
      data: { start, end: start + 4000, refName: 'ctgA', name: `v${i}` },
    })),
    genotypeDict: ['0/0', '1/1'],
    sampleNames: ROW_NAMES,
    perRegionCellData: {
      0: cellPayloadOf(
        [0, 1].map(i =>
          featureInfoOf(`v${i}`, {
            length: 4000,
            genotypeCodes: Uint32Array.of(1, 2),
          }),
        ),
        {
          cellFeatureIndices: Uint32Array.of(0, 1, 0, 1),
          cellRowIndices: Uint32Array.of(0, 0, 1, 1),
          cellColors: Uint32Array.of(
            0xffcccccc,
            0xffcccccc,
            0xff0000ff,
            0xff0000ff,
          ),
          cellAltDosage: Uint8Array.of(0, 0, 255, 255),
          numCells: 4,
          refCellCount: 2,
          featurePositions: Uint32Array.of(0, 4000, 4000, 8000),
        },
      ),
    },
  })
}

function loaded(variantLayout: 'genomic' | 'columns', tree?: string) {
  const { display, view } = createTestEnvironment({
    displayConfig: { variantLayout, ...(tree ? { rows: { tree } } : {}) },
  }).createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 8000, refName: 'ctgA' },
  ])
  view.zoomTo(10)
  view.scrollTo(0)
  display.setSources(ROW_NAMES.map(name => ({ name, sampleName: name })))
  display.setRowHeight(20)
  display.setCellData(cellData())
  return display
}

// The sidebar's hit box stacks over the canvas, but a click or right-click
// reaching the canvas under it must still find no cell there.
test.each(['genomic', 'columns'] as const)(
  'the %s layout hits no cell under the tree sidebar, and the cell past it',
  layout => {
    const surface =
      layout === 'genomic' ? variantRowsSurface : variantMatrixSurface
    const bare = loaded(layout)
    expect(bare.dataLeft).toBe(0)
    expect(surface(bare).getHit(10, 25)).toBeDefined()

    const treed = loaded(layout, '(S0,S1);')
    expect(treed.dataLeft).toBeGreaterThan(10)
    expect(surface(treed).getHit(10, 25)).toBeUndefined()
    expect(surface(treed).getHit(treed.dataLeft, 25)).toBeDefined()
  },
)
