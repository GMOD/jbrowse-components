import { makeFeatureData } from '../RenderFeatureDataRPC/testUtils.ts'
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
      1,
      region,
    )
    expect(display.showGeneGlyphNotice).toBe(false)

    // multi-isoform gene present under longestCoding → visible + loud chip
    display.setRpcData(
      0,
      makeFeatureData({ hasMultiIsoformGenes: true }),
      1,
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
      1,
      region,
    )

    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphNoticeDismissed).toBe(false)

    display.dismissGeneGlyphNotice()

    // still visible (renders as the quiet icon button), just marked dismissed
    expect(display.showGeneGlyphNotice).toBe(true)
    expect(display.geneGlyphNoticeDismissed).toBe(true)
  })
})
