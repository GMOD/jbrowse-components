import { createMafTestEnvironment } from './testEnv.ts'

// The rows can be colored exactly one way — `activeRowRendering` paints one and
// resolves a clash by precedence — but the three settings behind that choice are
// independent config slots, and the menu used to offer them as independent
// controls. Picking through `setRowRendering` is what makes the tick the truth.
describe('row coloring is one choice across three slots', () => {
  it('defaults to the bases', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.selectedRowRendering).toBe('bases')
  })

  it('selecting source chromosome clears an identity plot', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('heatmap')
    expect(display.selectedRowRendering).toBe('heatmap')
    expect(display.rowIdentityMode).toBe('heatmap')

    display.setRowRendering('sourceChrom')
    expect(display.selectedRowRendering).toBe('sourceChrom')
    expect(display.colorByChromosome).toBe(true)
    // the losing setting is turned off, not left on and outvoted
    expect(display.rowIdentityMode).toBe('none')
  })

  it('selecting an identity plot clears source chromosome', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('sourceChrom')
    display.setRowRendering('xyplot')
    expect(display.selectedRowRendering).toBe('xyplot')
    expect(display.colorByChromosome).toBe(false)
    expect(display.rowIdentityMode).toBe('xyplot')
  })

  it('selecting the bases clears everything else', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('sourceChrom')
    display.setRowRendering('bases')
    expect(display.selectedRowRendering).toBe('bases')
    expect(display.colorByChromosome).toBe(false)
    expect(display.rowIdentityMode).toBe('none')
    expect(display.showTranslation).toBe(false)
  })

  // The state the old menu could produce, and a saved session or hand-written
  // config still can: two of the three slots on at once. Nothing migrates it —
  // the getter reports the one that actually paints, and the next pick through
  // the radio clears the rest. Set here through the individual slot actions,
  // which is exactly the path that used to strand a setting.
  it('reports the winner when two slots are on, and the next pick clears it', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowIdentityMode('heatmap')
    display.setColorByChromosome(true)

    // both on; source chromosome outranks the identity plot
    expect(display.selectedRowRendering).toBe('sourceChrom')
    expect(display.activeRowRendering).toBe('sourceChrom')

    display.setRowRendering('heatmap')
    expect(display.colorByChromosome).toBe(false)
    expect(display.selectedRowRendering).toBe('heatmap')
  })

  // Codons need a reading frame, so the option is not offered — and not
  // reachable — without a `mafFrames` adapter. This track has none.
  it('does not select codon view without a frames adapter', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('codon')
    expect(display.annotationAdapterConfig).toBeUndefined()
    expect(display.selectedRowRendering).toBe('bases')
  })
})

// `activeRowRendering` starts from `selectedRowRendering` rather than restating
// its precedence, so the two can't disagree about which setting won. What is
// left to it is the two things that override a selection — the summary path and
// zoom — and the rule that it falls back to the bases, never to a losing slot.
describe('what paints is the selection, overridden only by zoom and summary', () => {
  // Presence is all the gates read, and the RPC that would fetch the file is
  // stubbed, so the shape of the frames adapter doesn't matter here.
  const framesEnv = (opts: { summaryAdapter?: unknown } = {}) =>
    createMafTestEnvironment({
      annotationAdapter: { type: 'BigBedAdapter' },
      ...opts,
    })

  // `zoomedToBaseLevel` reads the *debounced* coarse zoom, and the view autorun
  // that publishes it doesn't run headless — so a test that only calls zoomTo
  // silently keeps whatever zoom the model was created at.
  function zoomAndSettle(
    view: ReturnType<
      ReturnType<typeof createMafTestEnvironment>['createDisplay']
    >['view'],
    bpPerPx: number,
  ) {
    view.zoomTo(bpPerPx)
    view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  }

  it('draws codons at base level and the bases zoomed out', () => {
    const { display, view } = framesEnv().createDisplay()
    display.setRowRendering('codon')
    zoomAndSettle(view, 0.5)
    expect(display.selectedRowRendering).toBe('codon')
    expect(display.zoomedToBaseLevel).toBe(true)
    expect(display.activeRowRendering).toBe('codon')

    // Same selection, zoomed out: codons are not resolvable, so the rows go
    // back to the bases. The selection is remembered, not repainted as
    // something else, and the menu's tick doesn't move.
    zoomAndSettle(view, 100)
    expect(display.selectedRowRendering).toBe('codon')
    expect(display.activeRowRendering).toBe('bases')
  })

  it('yields an identity plot to the bases at base level, unless pinned', () => {
    const { display, view } = framesEnv().createDisplay()
    display.setRowRendering('heatmap')
    zoomAndSettle(view, 100)
    expect(display.activeRowRendering).toBe('heatmap')

    // UCSC wigMaf: zoomed in, the letters say more than a per-pixel mean of them
    zoomAndSettle(view, 0.5)
    expect(display.activeRowRendering).toBe('bases')

    display.setRowIdentityAutoZoom(false)
    expect(display.activeRowRendering).toBe('heatmap')
  })

  // The cheap summary path carries neither per-row bases nor per-row source
  // chromosomes, so no alternative can draw from it.
  it('draws none of the alternatives on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.showSummary).toBe(true)

    for (const rendering of ['sourceChrom', 'heatmap', 'xyplot'] as const) {
      display.setRowRendering(rendering)
      expect(display.selectedRowRendering).toBe(rendering)
      expect(display.activeRowRendering).toBe('bases')
    }
  })

  // ...and the base canvas can't draw from it either. `activeRowRendering`
  // resolving to `bases` above says only that no *alternative* applies; the
  // summary fetch clears `rpcDataMap` on purpose and the rows on screen are the
  // summary overlay's. Reading the second question off the first pinned the
  // display in `loading` forever: the render callback painted from the empty
  // map, `renderBlocks` reported `painted: false` every frame, `canvasDrawn`
  // never flipped, and the scrim sat over a fully loaded track. Nothing caught
  // it because the summary bars underneath rendered correctly the whole time.
  it('does not hand the rows to the base canvas on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.showSummary).toBe(true)

    expect(display.activeRowRendering).toBe('bases')
    expect(display.basesRenderingActive).toBe(false)

    // and the per-base overlays that gate on it stay off, so no frame pays for
    // markers drawn over a rendering that isn't theirs
    expect(display.visibleLabels).toEqual([])
    expect(display.visibleInsertions).toEqual([])
  })

  // The same track below the floor takes the real alignment path, so the base
  // canvas owns the rows again — the exclusion above is the summary path's, not
  // a blanket "a summary adapter is configured".
  it('hands the rows back to the base canvas below the summary floor', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 0.5)
    expect(display.showSummary).toBe(false)
    expect(display.basesRenderingActive).toBe(true)
  })

  // The coverage band's depths come off the alignment blocks the summary path
  // clears, so it reserved its height and painted nothing into it — no bars, no
  // axis, no label. It collapses instead, and the rows start at the top of the
  // track.
  it('collapses the coverage band on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.showSummary).toBe(true)

    expect(display.coverageBandActive).toBe(false)
    expect(display.coverageDisplayHeight).toBe(0)
    expect(display.rowsTopOffset).toBe(0)
    expect(display.coverageDomain).toBeUndefined()

    // the *setting* is untouched, so the menu tick still reports what the user
    // chose rather than where they are zoomed
    expect(display.showCoverage).toBe(true)
  })

  // ...and it comes back on zoom-in without the user having to re-tick it,
  // which is the whole reason the collapse lives on a derived getter instead of
  // on the config slot.
  it('restores the coverage band below the summary floor', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.coverageDisplayHeight).toBe(0)

    zoomAndSettle(view, 0.5)
    expect(display.coverageBandActive).toBe(true)
    expect(display.coverageDisplayHeight).toBe(display.coverageHeight)
    expect(display.rowsTopOffset).toBe(display.coverageHeight)
  })

  // The conservation band had the identical bug and no `…BandActive` getter to
  // fix it: percent identity is computed from `coverage.identityScores` on the
  // alignment blocks, which the summary path clears, so `showConservation`
  // alone drew 40px of band, a fixed 0-100% axis and a resize handle over
  // nothing. Off by default, which is the only reason it outlived its twin.
  it('collapses the conservation band on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    display.setShowConservation(true)
    zoomAndSettle(view, 100)
    expect(display.showSummary).toBe(true)

    expect(display.conservationBandActive).toBe(false)
    expect(display.conservationDisplayHeight).toBe(0)
    // both bands gone, so the rows own the whole track
    expect(display.rowsTopOffset).toBe(0)
    // and no titles: they exist to tell two stacked histograms apart
    expect(display.bandLabels).toEqual([])

    // the *setting* is untouched, same as coverage
    expect(display.showConservation).toBe(true)
  })

  it('restores the conservation band below the summary floor', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    display.setShowConservation(true)
    zoomAndSettle(view, 100)
    expect(display.conservationDisplayHeight).toBe(0)

    zoomAndSettle(view, 0.5)
    expect(display.conservationBandActive).toBe(true)
    expect(display.conservationDisplayHeight).toBe(display.conservationHeight)
    expect(display.rowsTopOffset).toBe(
      display.coverageHeight + display.conservationHeight,
    )
    expect(display.bandLabels.map(l => l.text)).toEqual([
      'Coverage',
      'Conservation (% identity)',
    ])
  })

  // The codon variant of the band already excluded the summary path with a term
  // of its own; it now inherits it, so the two cannot end up disagreeing about
  // where the band draws.
  it('keeps the codon conservation band off on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    display.setShowConservation(true)
    display.setConservationMode('codon')
    zoomAndSettle(view, 100)
    expect(display.codonConservationActive).toBe(false)
    expect(display.visibleCodonConservation).toEqual([])
  })

  // Turning it off by hand still wins — the summary path is an extra reason the
  // band can't draw, not the only one.
  it('keeps the band off on the summary path when the user turned it off', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    display.setShowCoverage(false)
    zoomAndSettle(view, 100)
    expect(display.coverageBandActive).toBe(false)

    zoomAndSettle(view, 0.5)
    expect(display.coverageBandActive).toBe(false)
    expect(display.coverageDisplayHeight).toBe(0)
  })

  // The state the old menu of independent checkboxes could reach, and a
  // hand-written config still can. Re-deriving precedence let the losing slot
  // take over at the zooms where the winner couldn't draw, so the menu ticked
  // "Codon changes" while the rows were colored by source chromosome.
  it('falls back to the bases, not to a losing slot, when two are set', () => {
    const { display, view } = framesEnv().createDisplay()
    display.setShowTranslation(true)
    display.setColorByChromosome(true)
    zoomAndSettle(view, 100)

    expect(display.selectedRowRendering).toBe('codon')
    expect(display.zoomedToBaseLevel).toBe(false)
    expect(display.activeRowRendering).toBe('bases')
  })
})
