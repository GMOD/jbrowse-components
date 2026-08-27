import {
  makeFeatureData,
  packStackedGenes,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

// The bottom-right isoform-collapse control (GeneGlyphControl) is gated by
// showGeneGlyphNotice: the loaded data has a multi-isoform gene, so switching
// modes is meaningful. It stays visible in every mode (geneGlyphCollapsed only
// picks the loud chip vs the quiet icon) so picking "All transcripts" from its
// own menu doesn't make the control disappear. Dismissing only shrinks the loud
// chip to the quiet icon (geneGlyphNoticeDismissed) — it must NOT drop the
// control, so showGeneGlyphNotice stays true through a dismiss.

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

    // no multi-isoform gene in the data → nothing to switch, control hidden
    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: false }),
      region,
    )
    expect(display.showGeneGlyphNotice).toBe(false)

    // multi-isoform gene present under longestCoding → visible + loud chip
    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: true }),
      region,
    )
    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphCollapsed).toBe(true)

    // switching to All transcripts keeps the control (as the quiet icon) so the
    // user can switch back — it must not vanish
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

    // still visible (renders as the quiet icon button), just marked dismissed
    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphNoticeDismissed).toBe(true)
  })

  // The shared canvas body renders the control from this one hook, whose base
  // default is `undefined` (the variant display shares that body and has no
  // geneGlyphMode slot to answer with). So the bundle both existing and carrying
  // working actions is the whole contract: reorder the `.views()` blocks so the
  // base default wins and the chip silently vanishes with nothing else failing.
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

    // the bundled callbacks are the model's own actions, not inert copies
    display.geneGlyphNotice!.setMode('all')
    expect(display.geneGlyphMode).toBe('all')
    expect(display.geneGlyphNotice!.collapsed).toBe(false)

    display.geneGlyphNotice!.dismiss()
    expect(display.geneGlyphNotice!.dismissed).toBe(true)
  })

  // The chip names the rule that picked the transcripts on screen (`RefSeq
  // Select`), which only the worker knows — it reports one summary per region
  // and the notice sums them, since the chip speaks for the whole view.
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

  // The trim's chip announces a number, so it must fire on a trim that actually
  // dropped something — a track tall enough for every gene in view trims
  // nothing, and the ladder's own solve is where that shows.
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

  // "All transcripts" is a promise in those words, so the height that trims
  // under `auto` must take nothing under `all` — the surplus scrolls. Same
  // gene, same 60px, so the only difference is the mode.
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

  // Zooming out past `auto`'s threshold puts every multi-isoform gene through
  // the worker's `longestCoding` collapse, which reports a pick per gene. The
  // ladder trimmed none of them, so the chip must not claim a count.
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
