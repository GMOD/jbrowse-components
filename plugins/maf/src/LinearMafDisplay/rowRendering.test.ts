import { createMafTestEnvironment } from './testEnv.ts'

// The rows are coloured by one field and, as a bar chart, may carry identity
// on the bar height; the Row coloring radio writes the pair.
describe('row coloring is the color field and the bar height', () => {
  it('defaults to the mismatches', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.colorField).toBe('mismatch')
    expect(display.yField).toBeUndefined()
    expect(display.selectedRowRendering).toBe('mismatch')
  })

  it('the X-Y plot pick writes identity on y, and a colour pick clears it', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('xyplot')
    expect(display.yField).toBe('identity')
    expect(display.colorField).toBe('mismatch')
    expect(display.selectedRowRendering).toBe('xyplot')

    display.setRowRendering('chromosome')
    expect(display.yField).toBeUndefined()
    expect(display.colorField).toBe('chromosome')
    expect(display.selectedRowRendering).toBe('chromosome')
  })

  it('takes a colour and a bar height a config names together', () => {
    const { display } = createMafTestEnvironment({
      displayConfig: {
        color: 'identity',
        y: 'identity',
        rowIdentityAutoZoom: false,
      },
    }).createDisplay()
    expect(display.selectedRowRendering).toBe('xyplot')
    expect(display.rowsColor).toBe('identity')
    expect(display.rowsY).toBe('identity')
  })

  // Codons need a reading frame, so the option is not offered — and not
  // reachable — without a `mafFrames` adapter. This track has none.
  it('does not select codon view without a frames adapter', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('codon')
    expect(display.annotationAdapterConfig).toBeUndefined()
    expect(display.selectedRowRendering).toBe('mismatch')
    expect(display.rowsColor).toBe('mismatch')
  })
})

// What paints is the setting, overridden only by the summary tier and zoom,
// and falling back to the mismatches.
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
    expect(display.activeRowRendering).toBe('mismatch')
  })

  it('yields an identity plot to the bases at base level, unless pinned', () => {
    const { display, view } = framesEnv().createDisplay()
    display.setRowRendering('identity')
    zoomAndSettle(view, 100)
    expect(display.activeRowRendering).toBe('identity')

    // UCSC wigMaf: zoomed in, the letters say more than a per-pixel mean of them
    zoomAndSettle(view, 0.5)
    expect(display.activeRowRendering).toBe('mismatch')

    display.setRowIdentityAutoZoom(false)
    expect(display.activeRowRendering).toBe('identity')
  })

  it('yields the bar height to the colour field at base level', () => {
    const { display, view } = createMafTestEnvironment({
      displayConfig: { color: 'base', y: 'identity' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.activeRowRendering).toBe('xyplot')
    zoomAndSettle(view, 0.5)
    expect(display.activeRowRendering).toBe('base')
    expect(display.basesRenderingActive).toBe(true)
  })

  // The cheap summary path carries neither per-row bases nor per-row source
  // chromosomes, so no alternative can draw from it.
  it('draws none of the alternatives on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.coarseTierActive).toBe(true)

    for (const rendering of ['chromosome', 'identity', 'xyplot'] as const) {
      display.setRowRendering(rendering)
      expect(display.selectedRowRendering).toBe(rendering)
      expect(display.activeRowRendering).toBe('mismatch')
    }
  })

  // ...and the base canvas can't draw from it either. `activeRowRendering`
  // resolving to `mismatch` above says only that no *alternative* applies; the
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
    expect(display.coarseTierActive).toBe(true)

    expect(display.activeRowRendering).toBe('mismatch')
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
    expect(display.coarseTierActive).toBe(false)
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
    expect(display.coarseTierActive).toBe(true)

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
    expect(display.coarseTierActive).toBe(true)

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
    expect(display.rowsEncodeProps().codons).toBeUndefined()
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
})
