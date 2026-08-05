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
