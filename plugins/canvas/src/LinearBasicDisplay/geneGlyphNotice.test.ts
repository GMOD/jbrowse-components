import {
  makeFeatureData,
  packStackedGenes,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

const region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 100,
  reversed: false,
}

describe('gene-glyph collapse notice', () => {
  it('shows whenever a multi-isoform gene is loaded, in every mode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('longestCoding')

    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: false }),
      region,
    )
    expect(display.showGeneGlyphNotice).toBe(false)

    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: true }),
      region,
    )
    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphCollapsed).toBe(true)

    display.setGeneGlyphMode('all')
    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphCollapsed).toBe(false)
  })

  it('dismiss keeps the control (minimizes it), it does not remove it', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('longestCoding')
    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: true }),
      region,
    )

    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphNoticeDismissed).toBe(false)

    display.dismissGeneGlyphNotice()

    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphNoticeDismissed).toBe(true)
  })

  it('exposes the control as a geneGlyphNotice bundle wired to the actions', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('longestCoding')

    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: false }),
      region,
    )
    expect(display.geneGlyphNotice).toBeUndefined()

    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: true }),
      region,
    )
    expect(display.geneGlyphNotice).toEqual({
      collapsed: true,
      dismissed: false,
      mode: 'longestCoding',
      picks: { byTag: {}, byLength: 0, byCap: 0 },
      setMode: expect.any(Function),
      dismiss: expect.any(Function),
    })

    display.geneGlyphNotice!.setMode('all')
    expect(display.geneGlyphMode).toBe('all')
    expect(display.geneGlyphNotice!.collapsed).toBe(false)

    display.geneGlyphNotice!.dismiss()
    expect(display.geneGlyphNotice!.dismissed).toBe(true)
  })

  it('sums each region’s picks into the notice the chip reads', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('longestCoding')

    for (const [num, byTag] of [
      [0, { 'RefSeq Select': 3 }],
      [1, { 'RefSeq Select': 2, 'MANE Select': 1 }],
    ] as const) {
      display.setRpcData(
        num,
        makeFeatureData({
          hasMultiIsoformGenes: true,
          isoformPicks: { byTag, byLength: 1, byCap: 0 },
        }),
        { ...region, start: num * 100, end: num * 100 + 100 },
      )
    }

    expect(display.geneGlyphNotice!.picks).toEqual({
      byTag: { 'RefSeq Select': 5, 'MANE Select': 1 },
      byLength: 2,
      byCap: 0,
    })
  })

  it('announces the trim only once the ladder has made one', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('auto')
    display.configuration.setSlot('height', 600)
    display.setRpcData(
      0,
      packStackedGenes([
        { featureId: 'gene1', startBp: 0, endBp: 5000, isoforms: 12 },
      ]),
      region,
    )
    expect(display.geneGlyphIsoformCap).toBeUndefined()
    expect(display.geneGlyphCollapsed).toBe(false)

    display.configuration.setSlot('height', 60)
    expect(display.geneGlyphIsoformCap).toBeLessThan(12)
    expect(display.geneGlyphCollapsed).toBe(true)
  })

  it('never trims under All transcripts, however short the track', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.configuration.setSlot('height', 60)
    display.setRpcData(
      0,
      packStackedGenes([
        { featureId: 'gene1', startBp: 0, endBp: 5000, isoforms: 12 },
      ]),
      region,
    )

    display.setGeneGlyphMode('auto')
    expect(display.geneGlyphIsoformCap).toBeLessThan(12)

    display.setGeneGlyphMode('all')
    expect(display.showsEveryIsoform).toBe(true)
    expect(display.geneGlyphIsoformCap).toBeUndefined()
    expect(display.geneGlyphCollapsed).toBe(false)
    expect(display.geneGlyphTrimmedGenes.size).toBe(0)
  })

  it('does not announce a trim on data the collapse mode hid', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setGeneGlyphMode('auto')
    display.configuration.setSlot('height', 600)

    display.setRpcData(
      0,
      makeFeatureData({
        hasMultiIsoformGenes: true,
        isoformPicks: { byTag: { 'MANE Select': 4 }, byLength: 2, byCap: 0 },
      }),
      region,
    )
    expect(display.geneGlyphIsoformCap).toBeUndefined()
  })
})
