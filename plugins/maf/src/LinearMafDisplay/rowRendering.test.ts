import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createMafTestEnvironment, zoomPastBaseLevel } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The rows take a fill, `encoding.color`, a bar height, `encoding.y`, and the
// layers over the fill, `alignments.mismatches` and `alignments.bases`: four
// settings, written apart, as alignments writes its read fill and its layers.
describe('the rows are a fill, a bar height and the layers over them', () => {
  it('defaults to the constant fill with the mismatches over it', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.colorField).toBeUndefined()
    expect(display.yField).toBeUndefined()
    expect(display.basesField).toBeUndefined()
    expect(display.rowPlan).toEqual({
      mark: 'rect',
      color: undefined,
      mismatches: true,
      bases: undefined,
      perBase: true,
    })
  })

  it('a bar height pick keeps the fill, and a fill pick keeps the bars', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    zoomPastBaseLevel(view)
    display.setYField('identity')
    expect(display.rowPlan).toMatchObject({ mark: 'bar', color: undefined })

    display.colorByField('identity')
    expect(display.yField).toBe('identity')
    expect(display.rowPlan).toMatchObject({ mark: 'bar', color: 'identity' })

    display.setYField(undefined)
    expect(display.rowPlan).toMatchObject({ mark: 'rect', color: 'identity' })
  })

  it('the mismatches draw over a field fill, and their toggle takes them off', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    zoomPastBaseLevel(view)
    display.colorByField('refNameRank')
    expect(display.rowPlan).toMatchObject({ mismatches: true, perBase: true })
    display.setShowMismatches(false)
    expect(display.rowPlan).toMatchObject({ mismatches: false, perBase: false })
  })

  it('the base layer paints every base, and the mismatches yield to it', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setBasesField('base')
    expect(display.rowPlan).toMatchObject({
      mismatches: false,
      bases: 'base',
      perBase: true,
    })
    display.setBasesField(undefined)
    expect(display.rowPlan.bases).toBeUndefined()
  })

  // Codons need a reading frame, so the layer draws nothing without a
  // `mafFrames` adapter, and the mismatches draw in its place.
  it('a codon layer with no frames adapter leaves the mismatches', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setBasesField('codon')
    expect(display.framesAdapterConfig).toBeUndefined()
    expect(display.basesField).toBe('codon')
    expect(display.rowPlan).toMatchObject({
      bases: undefined,
      mismatches: true,
    })
  })

  it('a scheme pick paints identity along it, over a written range', () => {
    const { display } = createMafTestEnvironment({
      displayConfig: {
        encoding: {
          color: { field: 'identity', scale: { range: ['red', 'blue'] } },
        },
      },
    }).createDisplay()
    expect(display.colorScheme).toBeUndefined()
    display.setColorScheme('viridis')
    expect(display.colorScheme).toBe('viridis')
    expect(display.colorEncoding).toMatchObject({
      scheme: 'viridis',
      range: undefined,
    })
  })
})

describe('the track menu writes the fill, the layers and the bar height apart', () => {
  function subMenu(items: MenuItem[], label: string) {
    const item = items.find(i => 'label' in i && i.label === label)
    return item && 'subMenu' in item ? resolveSubMenu(item) : []
  }
  function labels(items: MenuItem[]) {
    return items.flatMap(i => ('label' in i ? [i.label] : []))
  }
  function pick(
    display: { trackMenuItems: () => MenuItem[] },
    menu: string,
    label: string,
  ) {
    const row = subMenu(display.trackMenuItems(), menu).find(
      i => 'label' in i && i.label === label,
    )
    if (row && 'onClick' in row) {
      row.onClick()
    }
  }

  it('lists the fills, the per-base layers, and the scheme only under identity', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    zoomPastBaseLevel(view)
    const colorBy = () => subMenu(display.trackMenuItems(), 'Color by')
    expect(labels(colorBy())).toEqual(
      expect.arrayContaining([
        'Default',
        'Identity to reference',
        'Source sequence',
        'Solid color...',
        'None',
        'Every base',
      ]),
    )
    expect(labels(colorBy())).not.toContain('Codon changes (amino acids)')
    expect(labels(colorBy())).not.toContain('Color scheme')

    display.colorByField('identity')
    expect(labels(colorBy())).toContain('Color scheme')
  })

  it('reaches identity bars on the identity ramp, then back to the default', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    zoomPastBaseLevel(view)
    pick(display, 'Color by', 'Identity to reference')
    pick(display, 'Plot type', 'Identity X-Y plot')
    expect(display.rowPlan).toMatchObject({ mark: 'bar', color: 'identity' })
    pick(display, 'Color by', 'Default')
    expect(display.colorField).toBeUndefined()
  })

  it('turns the base layer on and off from its own block', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    pick(display, 'Color by', 'Every base')
    expect(display.basesField).toBe('base')
    pick(display, 'Color by', 'None')
    expect(display.basesField).toBeUndefined()
  })
})

// What paints is the setting, overridden only by the summary tier and zoom.
describe('what paints is the selection, overridden only by zoom and summary', () => {
  // Presence is all the gates read, and the RPC that would fetch the file is
  // stubbed, so the shape of the frames adapter doesn't matter here.
  const framesEnv = (opts: { summaryAdapter?: unknown } = {}) =>
    createMafTestEnvironment({
      framesAdapter: { type: 'BigBedAdapter' },
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

  it('draws the codon layer at base level and the mismatches zoomed out', () => {
    const { display, view } = framesEnv().createDisplay()
    display.setBasesField('codon')
    zoomAndSettle(view, 0.5)
    expect(display.zoomedToBaseLevel).toBe(true)
    expect(display.rowPlan).toMatchObject({ bases: 'codon', mismatches: false })

    // Same setting, zoomed out: codons are not resolvable, so the mismatches
    // draw. The setting is remembered and the menu's tick doesn't move.
    zoomAndSettle(view, 100)
    expect(display.basesField).toBe('codon')
    expect(display.rowPlan).toMatchObject({
      bases: undefined,
      mismatches: true,
    })
  })

  it('yields an identity fill to the constant at base level', () => {
    const { display, view } = framesEnv().createDisplay()
    display.colorByField('identity')
    zoomAndSettle(view, 100)
    expect(display.rowPlan.color).toBe('identity')

    // UCSC wigMaf: zoomed in, the letters say more than a per-pixel mean of them
    zoomAndSettle(view, 0.5)
    expect(display.rowPlan.color).toBeUndefined()
    expect(display.rowPlan.perBase).toBe(true)
  })

  it('yields the bar height to the cells at base level', () => {
    const { display, view } = createMafTestEnvironment({
      displayConfig: {
        encoding: { y: 'identity' },
        alignments: { bases: { show: true } },
      },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.rowPlan).toMatchObject({ mark: 'bar', perBase: false })
    zoomAndSettle(view, 0.5)
    expect(display.rowPlan).toMatchObject({
      mark: 'rect',
      bases: 'base',
      perBase: true,
    })
  })

  // The cheap summary path carries neither per-row bases nor per-row source
  // sequences, so no field or layer can draw from it.
  it('draws the constant fill and no layer on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.coarseTierActive).toBe(true)

    for (const field of ['refNameRank', 'identity'] as const) {
      display.colorByField(field)
      expect(display.colorField).toBe(field)
      expect(display.rowPlan.color).toBeUndefined()
    }
    display.setYField('identity')
    expect(display.rowPlan).toMatchObject({
      mark: 'rect',
      mismatches: false,
      perBase: false,
    })
  })

  // ...and the per-base painters can't draw from it either. The summary fetch
  // clears `rpcDataMap` on purpose and the rows on screen are the summary
  // overlay's. Reading "the bases draw" off the setting pinned the display in
  // `loading` forever: the render callback painted from the empty map,
  // `renderBlocks` reported `painted: false` every frame, `canvasDrawn` never
  // flipped, and the scrim sat over a fully loaded track.
  it('does not hand the rows to the per-base painters on the summary path', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 100)
    expect(display.coarseTierActive).toBe(true)
    expect(display.rowPlan.perBase).toBe(false)

    expect(display.visibleLabels).toEqual([])
    expect(
      [...display.encodedUpload.values()].some(p => p.insertions?.count),
    ).toBe(false)
  })

  // The same track below the floor takes the real alignment path, so the
  // per-base painters own the rows again.
  it('hands the rows back to the per-base painters below the summary floor', () => {
    const { display, view } = framesEnv({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()
    zoomAndSettle(view, 0.5)
    expect(display.coarseTierActive).toBe(false)
    expect(display.rowPlan.perBase).toBe(true)
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
    expect(display.coverageDepthDomain).toBeUndefined()

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
    display.setConservationUnit('codon')
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
