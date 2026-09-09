import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { takeSnackbarAction } from '@jbrowse/display-test-utils'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { autorun, when } from 'mobx'

import { LaneGene } from './geneGlyph.ts'
import { MIN_LANE_PITCH } from './laneStack.ts'
import { declaredLanesOf, staleLaneSpecs } from './model.ts'
import { createDisplay, createDisplayWithSession } from './testEnv.ts'

const namedGene = (
  uniqueId: string,
  name: string,
  start: number,
  end: number,
) =>
  new LaneGene(
    new SimpleFeature({
      uniqueId,
      name,
      refName: 'ctgA',
      start,
      end,
      type: 'gene',
    }),
  )

// The lane genes and lane links are a SECOND fetch, dependent on the ortholog
// fetch that draws the placement boxes.
//
// The retry rule those two used to break is NOT here any more, and that is the
// point: the committed key was compared by hand in `prepare` with no `reload()`
// override to match, so Retry re-ran both bodies into the same decline forever.
// It is `installFetch`'s key gate now — the skeleton stamps the key at commit,
// owns the compare and the reload that overrides it — so what pins it is
// `installFetch.test.ts`, once, for every fetch rather than for this display.
// What is left here is what stays this display's own.

// A dependent fetch that holds `displayPhase` at `loading` for every refetch
// puts the striped scrim over lanes that are already drawn: the fetch is
// debounced 500ms and the overlay's anti-flash delay is 250ms, so the scrim
// always won that race on any pan that moved a quantized lane window. Before
// the first commit there is nothing on screen to flash over and a capture
// would shoot placement boxes, which is what the gate is for.
test('the lane fetch is part of loading only until it first lands', () => {
  const display = createDisplay()
  // the harness mounts no canvas; the paint half of loading is the mixin's
  display.markCanvasDrawn()
  const [anchor] = display.laneGenesFetchSpecs
  expect(anchor).toBeDefined()
  expect(display.displayPhase).toBe('loading')

  display.setLaneGenes(
    new Map([[anchor!.lane, { key: anchor!.key, genes: [] }]]),
    undefined,
  )
  expect(display.displayPhase).toBe('ready')

  // the pan's refetch: the lanes are already drawn, and the phase says so
  display.setLaneGenes(
    new Map([[anchor!.lane, { key: 'a-later-window', genes: [] }]]),
    undefined,
  )
  expect(display.displayPhase).toBe('ready')
})

// The anchor's gene spec exists before the ortholog fetch has framed a single
// mate, so the first commit can be the anchor alone; a phase reading `ready`
// off that one shot the primate amylase figure as placement boxes with every
// mate lane still downloading. The commit that counts is the first covering a
// mate lane, which the fetch states off its own spec list.
test('the first landing that counts is the one covering a mate lane', () => {
  const display = createDisplay()
  display.setLaneGenes(new Map(), undefined)
  expect(display.laneGenesCoverMatesFor).toBeUndefined()
  display.setLaneGenes(new Map(), display.anchorAssemblyName)
  expect(display.laneGenesCoverMatesFor).toBe(display.anchorAssemblyName)
  // covered once is covered: a later anchor-only refetch does not lower it
  display.setLaneGenes(new Map(), undefined)
  expect(display.laneGenesCoverMatesFor).toBe(display.anchorAssemblyName)
})

// An all-vs-all file carries samples the config never declared, and those draw
// as lanes off the anchor fetch. The per-pair link fetch renames its region
// through the assembly manager, which refuses an assembly the session does not
// hold — so a spec naming one failed per pan and its ribbons never drew.
test('lane links are asked for only between lanes the session holds', () => {
  const display = createDisplay()
  const nameless = (id: string, mateAssembly: string) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      mate: {
        assemblyName: mateAssembly,
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    })
  display.setFeatures([
    nameless('f1', 'volvox_random'),
    nameless('f2', 'sample#1#undeclared'),
    nameless('f3', 'volvox_random'),
  ])
  expect(display.featuresAreNameless).toBe(true)
  expect(display.rowAssemblies).toEqual([
    'volvox_random',
    'sample#1#undeclared',
  ])
  const decision = {
    refName: 'ctgB',
    flipped: false,
    rung: 1,
    pivotAnchor: { refName: 'ctgA', coord: 200 },
    pivotLaneBp: 200,
    fitMin: 100,
    fitMax: 300,
    alsoOn: [],
    alsoOnMore: 0,
    pinned: false,
  }
  display.setLaneFrames(
    0,
    new Map([
      ['volvox_random', decision],
      ['sample#1#undeclared', decision],
    ]),
  )
  expect([...display.rowFrames.values()].every(Boolean)).toBe(true)
  expect(display.laneLinksFetchSpecs).toEqual([])

  display.setFeatures([
    nameless('f1', 'volvox_random'),
    nameless('f2', 'volvox_ins'),
  ])
  display.setLaneFrames(
    0,
    new Map([
      ['volvox_random', decision],
      ['volvox_ins', decision],
    ]),
  )
  expect(
    display.laneLinksFetchSpecs.map(s => [s.upperAssembly, s.lowerAssembly]),
  ).toEqual([['volvox_random', 'volvox_ins']])
})

// This display's `trackMenuItems` REPLACED the inherited list rather than
// appending to it. Nothing is lost by that today — `BaseDisplay` returns `[]`
// and neither mixin in the chain contributes a row — so this pins the item
// itself and the composition is hygiene against the chain growing one, which
// `addMenuItems` calls out as the silent half of writing an override by hand.
test('the stacked-synteny launcher is under Launch on the track menu, over the inherited rows', () => {
  const display = createDisplay()
  const items = display.trackMenuItems()

  // no lane-order row: the harness commits no features, so there is no mate
  // lane to order. `menus.test.ts` covers that one on its own
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Launch',
    undefined,
    'Color ribbons by',
    'Draw curved ribbons',
    'Bridge lanes that place nothing',
    'Show lane ticks',
  ])
  const [launch] = items
  const subMenu =
    launch && 'subMenu' in launch && typeof launch.subMenu !== 'function'
      ? launch.subMenu
      : []
  expect(subMenu.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Linear synteny view (visible region)',
  ])
})

// Nothing on screen says what a glyph color means: the display draws no labels,
// and the ecoli stack is forty-four lanes of them. The color is the CONFIG's
// encoding — `randomColor(feature.name)` over an ortholog table puts one color
// on one gene symbol — so the key reads the vocabulary back off the drawing
// rather than claiming one of its own.
test('the key names the anchor lane genes a name-hashed color slot draws', () => {
  const display = createDisplay()
  setConf(display, 'color', "jexl:randomColor(get(feature,'name'))")
  display.setLaneGenes(
    new Map([
      [
        'volvox',
        {
          key: display.laneGenesFetchSpecs[0]!.key,
          genes: [
            namedGene('g1', 'atpA', 100, 300),
            namedGene('g2', 'atpB', 400, 600),
          ],
        },
      ],
    ]),
    undefined,
  )
  expect(display.geneLegend.map(i => i.label)).toEqual(['atpA', 'atpB'])
  expect(new Set(display.geneLegend.map(i => i.color)).size).toBe(2)
  expect(display.colorScales.map(s => s.id)).toEqual(['genes'])
  expect(display.hasLegendKey).toBe(true)
  expect(
    display.trackMenuItems().map(i => ('label' in i ? i.label : undefined)),
  ).toContain('Show legend')
})

// The default `color` slot is one color for every gene, which keys nothing: a
// box of identical swatches spends the reader's attention to say the display
// has a color. The row is off the track menu with it.
test('a flat color slot has nothing to key', () => {
  const display = createDisplay()
  display.setLaneGenes(
    new Map([
      [
        'volvox',
        {
          key: display.laneGenesFetchSpecs[0]!.key,
          genes: [
            namedGene('g1', 'atpA', 100, 300),
            namedGene('g2', 'atpB', 400, 600),
          ],
        },
      ],
    ]),
    undefined,
  )
  expect(display.geneLegend).toEqual([])
  expect(display.hasLegendKey).toBe(false)
  expect(
    display.trackMenuItems().map(i => ('label' in i ? i.label : undefined)),
  ).not.toContain('Show legend')
})

// The ribbons are the other color vocabulary, and only `strand` gives it rows:
// a section of its own, so the connector colors are not read as glyph fills.
test('the strand ribbon mode adds its own section', () => {
  const display = createDisplay()
  setConf(display, 'color', "jexl:randomColor(get(feature,'name'))")
  display.setLaneGenes(
    new Map([
      [
        'volvox',
        {
          key: display.laneGenesFetchSpecs[0]!.key,
          genes: [
            namedGene('g1', 'atpA', 100, 300),
            namedGene('g2', 'atpB', 400, 600),
          ],
        },
      ],
    ]),
    undefined,
  )
  expect(display.colorScales.map(s => s.id)).toEqual(['genes'])

  display.setRibbonColorBy('strand')
  expect(display.colorScales.map(s => s.id)).toEqual(['genes', 'ribbons'])
})

// The two drawing settings were config-only, and a menu toggle that writes
// anywhere but the slot the getter reads is a checkbox that ticks and does
// nothing.
test('the drawing toggles write the slots the display reads back', () => {
  const display = createDisplay()
  expect(display.drawCurves).toBe(false)
  expect(display.showLaneTicks).toBe(true)

  display.setDrawCurves(true)
  display.setShowLaneTicks(false)
  expect(display.drawCurves).toBe(true)
  expect(display.showLaneTicks).toBe(false)
})

// `anchorSpans` is one of several producers of a ribbon endpoint pair, and the
// pair is ORDERED — the anchor's start first — not ascending. `ribbonPath`
// joins first end to first end, so sorting it here drew every
// anchor-to-lane-1 ribbon twisted where it should be straight (and straight
// where it should twist) on any reversed displayed region, which a `[rev]`
// locstring and a reversed panel of a synteny stack both produce.
describe('the anchor lane pair stays ordered', () => {
  function withGroup() {
    const display = createDisplay()
    display.setFeatures([
      new SimpleFeature({
        uniqueId: 'f1',
        name: 'gene1',
        refName: 'ctgA',
        start: 100,
        end: 300,
        strand: 1,
        mate: {
          assemblyName: 'volvox_random',
          refName: 'ctgB',
          start: 100,
          end: 300,
        },
      }),
    ])
    return display
  }

  function spanOf(display: ReturnType<typeof withGroup>) {
    const view = display.lgv
    const group = display.groups[0]!
    const { refName, start, end } = group.anchor
    const px = (coord: number) =>
      view.bpToPx({ refName, coord })!.offsetPx - view.offsetPx
    return {
      span: display.anchorSpans.get(group.key)!,
      atStart: px(start),
      atEnd: px(end),
    }
  }

  test('forward, the anchor start is the left end', () => {
    const { span, atStart, atEnd } = spanOf(withGroup())
    expect(span).toEqual([atStart, atEnd])
    expect(span[0]).toBeLessThan(span[1])
  })

  test('reversed, the anchor start is the RIGHT end', () => {
    const display = withGroup()
    display.lgv.setDisplayedRegions([
      {
        refName: 'ctgA',
        start: 0,
        end: 1000,
        assemblyName: 'volvox',
        reversed: true,
      },
    ])
    const { span, atStart, atEnd } = spanOf(display)
    expect(span).toEqual([atStart, atEnd])
    // the pair descends, and that descent is the orientation the ribbon draws
    expect(span[0]).toBeGreaterThan(span[1])
  })
})

// Re-anchoring replaces the hosting view's regions with another genome's, and
// what it discarded may be a region list built over several navigations, so
// the snackbar carries the same Undo the stacked view's moves offer.
test('re-anchoring offers an undo that puts the view back where it was', async () => {
  const { display, session } = createDisplayWithSession()
  const view = display.lgv
  const windowOf = () => ({
    regions: view.displayedRegions.map(r => ({ ...r })),
    start: view.windowStartBp,
    width: view.windowWidthBp,
  })
  const before = windowOf()
  display.reanchor('volvox', 'ctgA:1-100')
  for (let i = 0; i < 50 && !session.notifications.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(session.notifications.at(-1)?.message).toBe('Re-anchored on volvox')
  expect(windowOf()).not.toEqual(before)
  takeSnackbarAction(session, 'Undo')
  expect(windowOf()).toEqual(before)
})

// The clicked ribbon keeps an outline the way the pairwise view's does: the
// click records the hover's target, the passes compare it per instance, and
// only an empty-canvas click or a refetch lets it go.
test('a ribbon click keeps its outline id until empty canvas or a refetch', () => {
  const display = createDisplay()
  const feature = new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 100,
    end: 300,
  })
  display.setHoverTarget({ label: 'link', feature, targetIdx: 3 })
  display.selectHovered()
  expect(display.clickedFeatureId).toBe(4)
  expect(display.renderState.clickedFeatureId).toBe(4)

  // the pointer leaving does not release it
  display.setHoverTarget(undefined)
  expect(display.clickedFeatureId).toBe(4)

  // a stationary click on empty canvas does
  display.selectHovered()
  expect(display.clickedFeatureId).toBe(0)

  // and so does a refetch, whose targets a bare index no longer addresses
  display.setHoverTarget({ label: 'link', feature, targetIdx: 3 })
  display.selectHovered()
  display.setFeatures([])
  expect(display.clickedFeatureId).toBe(0)

  // a group-keyed click re-resolves against the rebuilt geometry instead,
  // since the click's own widget resizes the view and that refetches
  display.setHoverTarget({ label: 'g', feature, groupKey: 'g1', targetIdx: 2 })
  display.selectHovered()
  display.setFeatures([])
  expect(display.clickedTarget).toEqual({ groupKey: 'g1', targetIdx: 2 })
})

// A stack past ~8 lanes used to divide whatever height there was and crush;
// the fixed lane pitch and the scroll viewport are what replaced that. The
// floor rule itself is laneStack.test.ts's; here is what the display derives
// from it and what a scroll has to undo.
describe('the lane stack scrolls once lanes would crush', () => {
  const MATES = 20
  function stageManyMates(display: ReturnType<typeof createDisplay>) {
    display.setFeatures(
      Array.from(
        { length: MATES },
        (_, i) =>
          new SimpleFeature({
            uniqueId: `m${i}`,
            name: 'gene1',
            refName: 'ctgA',
            start: 100,
            end: 300,
            strand: 1,
            mate: {
              assemblyName: `mate${i}`,
              refName: 'ctgB',
              start: 100,
              end: 300,
            },
          }),
      ),
    )
  }

  test('scrollableHeight is 0 until the floor engages, then the shortfall', () => {
    const display = createDisplay()
    expect(display.scrollableHeight).toBe(0)
    stageManyMates(display)
    expect(display.scrollContentHeight).toBe((MATES + 1) * MIN_LANE_PITCH)
    expect(display.scrollableHeight).toBe(
      (MATES + 1) * MIN_LANE_PITCH - display.height,
    )
  })

  test('setScrollTop clamps into the scrollable range', () => {
    const display = createDisplay()
    stageManyMates(display)
    display.setScrollTop(1e6)
    expect(display.scrollTop).toBe(display.scrollableHeight)
    display.setScrollTop(-5)
    expect(display.scrollTop).toBe(0)
  })

  test('the render state carries the scroll and hitTest undoes it', () => {
    const display = createDisplay()
    stageManyMates(display)
    display.setLaneFrames(
      0,
      new Map([
        [
          'mate0',
          {
            refName: 'ctgB',
            flipped: false,
            rung: 1,
            pivotAnchor: { refName: 'ctgA', coord: 200 },
            pivotLaneBp: 200,
            fitMin: 100,
            fitMax: 300,
            alsoOn: [],
            alsoOnMore: 0,
            pinned: false,
          },
        ],
      ]),
    )
    const { lanes, glyphHeight } = display.laneStack
    const lane = lanes.find(l => l.assemblyName === 'mate0')!
    const [x1, x2] = lane.placements.get('gene1')!.spans[0]!
    const x = (x1 + x2) / 2
    const yContent = lane.glyphTop + glyphHeight / 2
    expect(display.hitTest(x, yContent)?.groupKey).toBe('gene1')

    display.setScrollTop(100)
    expect(display.renderState.scrollTopPx).toBe(100)
    expect(display.hitTest(x, yContent - 100)?.groupKey).toBe('gene1')
    expect(display.hitTest(x, yContent)).toBeUndefined()
  })
})

// `session.selection` is global, so before the `ownFeatureIds` gate a
// selection in ANY track recomputed `laneGlyphCells` — the jexl color per
// glyph, every lane repacked, every cell re-uploaded — for a highlight this
// display would never draw. The gate resolves a foreign selection to the same
// undefined as no selection, which invalidates nothing downstream.
test('a selection in another track does not rebuild the lane glyph cells', () => {
  const { display, session } = createDisplayWithSession()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'own1',
      name: 'gene1',
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    }),
  ])
  // keep the computed hot: outside a reaction it re-evaluates on every read
  // and identity says nothing
  const stop = autorun(() => display.laneGlyphCells)
  const before = display.laneGlyphCells
  session.setSelection(
    new SimpleFeature({
      uniqueId: 'some-other-tracks-feature',
      refName: 'ctgA',
      start: 0,
      end: 10,
    }),
  )
  expect(display.selectedFeatureId).toBeUndefined()
  expect(display.laneGlyphCells).toBe(before)

  // selecting one of its OWN features is the recompute the highlight needs
  session.setSelection(display.features![0]!)
  expect(display.selectedFeatureId).toBe('own1')
  expect(display.laneGlyphCells).not.toBe(before)
  stop()
})

// The lane genes fed `buildLanes`, so every gene commit — one per pan that
// moved a lane's fetch window — gave the stack a new identity, and with it the
// ribbon and tick cells: all re-uploaded, and the hover cleared under a
// stationary pointer, for a commit that changed no ribbon
test('a lane-genes commit leaves the stack and the ribbons where they were', () => {
  const display = createDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'own1',
      name: 'gene1',
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    }),
  ])
  // keep the computeds hot: outside a reaction they re-evaluate on every
  // read and identity says nothing
  const stop = autorun(() => [
    display.laneStack,
    display.ribbonGeometry,
    display.tickGeometry,
    display.laneGlyphCells,
  ])
  const stack = display.laneStack
  const ribbons = display.ribbonGeometry
  const ticks = display.tickGeometry
  const glyphs = display.laneGlyphCells

  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'ctgA',
    start: 120,
    end: 280,
    type: 'gene',
  })
  display.setLaneGenes(
    new Map([
      [
        'volvox',
        {
          key: display.laneGenesFetchSpecs[0]!.key,
          genes: [new LaneGene(gene)],
        },
      ],
    ]),
    undefined,
  )
  expect(display.laneStack).toBe(stack)
  expect(display.ribbonGeometry).toBe(ribbons)
  expect(display.tickGeometry).toBe(ticks)
  // the glyph cells are what a gene commit is for
  expect(display.laneGlyphCells).not.toBe(glyphs)
  expect(display.laneStack.lanes[0]!.hasAnnotation).toBe(true)
  stop()
})

const decisionOn = (refName: string, pivotLaneBp: number) => ({
  refName,
  flipped: false,
  rung: 1,
  pivotAnchor: { refName: 'ctgA', coord: 200 },
  pivotLaneBp,
  fitMin: pivotLaneBp - 100,
  fitMax: pivotLaneBp + 100,
  alsoOn: [],
  alsoOnMore: 0,
  pinned: false,
})

const mateRecord = (id: string, mateAssembly: string, name?: string) =>
  new SimpleFeature({
    uniqueId: id,
    name,
    refName: 'ctgA',
    start: 100,
    end: 300,
    strand: 1,
    mate: { assemblyName: mateAssembly, refName: 'ctgB', start: 100, end: 300 },
  })

const menuLabels = (display: ReturnType<typeof createDisplay>) =>
  display.trackMenuItems().map(i => ('label' in i ? i.label : undefined))

// polled, not `when`: a recorded RPC call is not an observable
async function until(condition: () => boolean) {
  for (let i = 0; i < 400 && !condition(); i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(condition()).toBe(true)
}

// The ortholog fetch asked an indexed PIF for its fine tier at every zoom, so
// a whole-chromosome window was a genome-wide fine fetch. The tier is
// resolved here off the settled zoom and rides the fetch key, the way the
// synteny view, the dotplot and LGVSyntenyDisplay already do it.
describe('the level-of-detail tier', () => {
  test('rides the fetch key and offers its menu on a tiered adapter', () => {
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'PairwiseIndexedPAFAdapter' },
    })
    expect(display.hasLodCapableAdapter).toBe(true)
    expect(display.lodTier).toBe('fine')
    const before = display.currentFetchKey
    expect(before).toContain('|fine|')

    display.setLodMode('coarse')
    expect(display.lodTier).toBe('coarse')
    expect(display.currentFetchKey).not.toBe(before)
    expect(display.currentFetchKey).toContain('|coarse|')
    expect(menuLabels(display)).toContain('Level of detail')
  })

  test('a file with no coarse tier resolves fine under a pinned coarse', () => {
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'PairwiseIndexedPAFAdapter' },
    })
    display.setLodMode('coarse')
    display.setLodTierInfo({ hasCoarseTier: false })
    expect(display.lodTier).toBe('fine')
  })

  test('a gene table has no tiers: no menu item, and a mode change moves nothing', () => {
    const display = createDisplay()
    expect(display.hasLodCapableAdapter).toBe(false)
    expect(menuLabels(display)).not.toContain('Level of detail')
    const before = display.currentFetchKey
    display.setLodMode('coarse')
    expect(display.lodTier).toBe('fine')
    expect(display.currentFetchKey).toBe(before)
  })

  test('the ortholog fetch and the link fetch pass the tier, and the header is read once', async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = []
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'PairwiseIndexedPAFAdapter' },
      rpc: async (name, args) => {
        calls.push({ name, args })
        return name === 'CoreGetInfo'
          ? { hasCoarseTier: true, coarseGap: 10000 }
          : []
      },
    })
    display.setLodMode('coarse')
    // the anchor's own gene fetch carries no opts at all
    const opts = (call: { args: Record<string, unknown> }) =>
      (call.args.opts ?? {}) as {
        lodMode?: string
        targetAssemblyName?: string
        clipToRegion?: boolean
      }
    await until(() => calls.some(c => c.name === 'CoreGetFeatures'))
    expect(opts(calls.find(c => c.name === 'CoreGetFeatures')!).lodMode).toBe(
      'coarse',
    )
    await when(() => display.lodTierInfo !== undefined, { timeout: 5000 })
    expect(calls.filter(c => c.name === 'CoreGetInfo')).toHaveLength(1)

    // the per-pair link fetch, once the anchor fetch has framed two lanes
    await when(() => display.features !== undefined, { timeout: 5000 })
    display.setFeatures([
      mateRecord('r1', 'volvox_random'),
      mateRecord('r2', 'volvox_ins'),
    ])
    display.setLaneFrames(
      0,
      new Map([
        ['volvox_random', decisionOn('ctgB', 200)],
        ['volvox_ins', decisionOn('ctgB', 200)],
      ]),
    )
    expect(display.laneLinksFetchSpecs.map(s => s.lodTier)).toEqual(['coarse'])
    const linkCall = () =>
      calls.find(
        c =>
          c.name === 'CoreGetFeatures' &&
          opts(c).targetAssemblyName === 'volvox_ins',
      )
    await until(() => linkCall() !== undefined)
    expect(opts(linkCall()!).lodMode).toBe('coarse')
    expect(opts(linkCall()!).clipToRegion).toBe(true)
  })

  // A liftOver chain spans tens of Mb, and a lane fitted to whole records sat
  // at 80x a 300 kb window: the fetch asks for the records cut to the window,
  // and asks over the view's blocks merged, so a record spanning two of them
  // is cut once rather than once per block.
  test('the ortholog fetch asks for records clipped to the merged blocks', async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = []
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'PairwiseIndexedPAFAdapter' },
      rpc: async (name, args) => {
        calls.push({ name, args })
        return name === 'CoreGetInfo' ? { hasCoarseTier: false } : []
      },
    })
    const blocks = display.lgv.staticBlocks.contentBlocks
    expect(blocks.map(b => [b.start, b.end])).toEqual([
      [0, 800],
      [800, 1000],
    ])
    await until(() => calls.some(c => c.name === 'CoreGetFeatures'))
    const { args } = calls.find(c => c.name === 'CoreGetFeatures')!
    expect(args.opts).toEqual({
      mateShape: 'grouped',
      lodMode: 'fine',
      clipToRegion: true,
      splitAtGapBp: 10000,
    })
    expect(args.regions).toEqual([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ])
  })
})

// `laneGenesFetchSpecs` folded every lane into one key and the fetch reissued
// every spec when it moved, so at 44 lanes a pan that moved one lane's
// quantized window cost 44 tabix RPCs and a commit that waited on all of them.
test('one lane’s window change refetches that lane alone', async () => {
  const calls: Record<string, unknown>[] = []
  const { display } = createDisplayWithSession({
    geneTracks: [
      { trackId: 'volvox_genes', assemblyNames: ['volvox'] },
      { trackId: 'volvox_random_genes', assemblyNames: ['volvox_random'] },
    ],
    rpc: async (name, args) => {
      if (name === 'CoreGetFeatures') {
        calls.push(args)
      }
      return []
    },
  })
  const geneCalls = () =>
    calls.filter(
      args =>
        (args.adapterConfig as { type: string }).type === 'Gff3TabixAdapter',
    )
  const laneOf = (args: Record<string, unknown>) =>
    (args.regions as { assemblyName: string }[])[0]!.assemblyName

  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([mateRecord('f1', 'volvox_random', 'gene1')])
  display.setLaneFrames(
    0,
    new Map([['volvox_random', decisionOn('ctgB', 200)]]),
  )
  expect(display.laneGenesFetchSpecs.map(s => s.lane)).toEqual([
    'volvox',
    'volvox_random',
  ])
  await when(() => display.laneGenes?.has('volvox_random') ?? false, {
    timeout: 5000,
  })
  expect(display.dataSuperseded).toBe(false)
  const anchorGenes = display.laneGenes!.get('volvox')
  const mateGenes = display.laneGenes!.get('volvox_random')
  const issued = geneCalls().length

  display.setLaneFrames(
    0,
    new Map([['volvox_random', decisionOn('ctgB', 100200)]]),
  )
  expect(display.dataSuperseded).toBe(true)
  await when(() => !display.dataSuperseded, { timeout: 5000 })
  const since = geneCalls().slice(issued)
  expect(since.map(laneOf)).toEqual(['volvox_random'])
  expect(display.laneGenes!.get('volvox')).toBe(anchorGenes)
  expect(display.laneGenes!.get('volvox_random')).not.toBe(mateGenes)
  expect(display.laneGenes!.get('volvox_random')!.key).toBe(
    display.laneGenesFetchSpecs[1]!.key,
  )
})

// `laneGlyphCells` resolved the `color` and `utrColor` jexl slots per gene on
// every lane whenever the stack changed, which is every settle. The colour
// depends on the feature, the config and the selection, never on the frame.
test('a settle rebuilds the lane cells against the same colour map', () => {
  const display = createDisplay()
  display.setFeatures([mateRecord('own1', 'volvox_random', 'gene1')])
  const gene = new SimpleFeature({
    uniqueId: 'g',
    refName: 'ctgA',
    start: 120,
    end: 280,
    type: 'gene',
  })
  display.setLaneGenes(
    new Map([
      [
        'volvox',
        {
          key: display.laneGenesFetchSpecs[0]!.key,
          genes: [new LaneGene(gene)],
        },
      ],
    ]),
    undefined,
  )
  const stop = autorun(() => [display.glyphColors, display.laneGlyphCells])
  const colors = display.glyphColors
  const cells = display.laneGlyphCells
  expect(colors.color.has('own1')).toBe(true)
  expect(colors.color.has('g')).toBe(true)
  expect(colors.utrColor.has('g')).toBe(true)

  display.setLaneFrames(
    37,
    new Map([['volvox_random', decisionOn('ctgB', 200)]]),
  )
  expect(display.laneGlyphCells).not.toBe(cells)
  expect(display.glyphColors).toBe(colors)

  // a gene commit is what the map is keyed on
  display.setLaneGenes(
    new Map([['volvox', { key: 'later', genes: [] }]]),
    undefined,
  )
  expect(display.glyphColors).not.toBe(colors)
  stop()
})

// `laneGeneAdapters` walked `session.tracks` while the "Open assembly" hop
// walked `allSessionTracks`, so a lane annotated through a connection read
// "no annotation" although the hop brought the track along.
test('a lane annotated through a connection has an annotation', () => {
  const { display } = createDisplayWithSession({
    connectionGeneTracks: [
      { trackId: 'volvox_random_genes', assemblyNames: ['volvox_random'] },
    ],
  })
  display.setFeatures([mateRecord('f1', 'volvox_random', 'gene1')])
  expect([...display.laneGeneAdapters.keys()]).toEqual([
    'volvox',
    'volvox_random',
  ])
  expect(display.laneGeneAdapters.get('volvox_random')).toMatchObject({
    type: 'Gff3TabixAdapter',
  })
  expect(
    display.laneStack.lanes.find(l => l.assemblyName === 'volvox_random')
      ?.hasAnnotation,
  ).toBe(true)
})

// A star of pairwise alignments — the HPRC vs-GRCh38 PAF, a
// MultiPairwiseSyntenyAdapter — holds no mate-vs-mate rows, so the second
// gutter down had nothing to draw. Wherever two lanes cover one stretch of the
// anchor, the link between them is composed through it.
describe('a star source composes its adjacent-pair links through the anchor', () => {
  const ribbonsBetweenMates = (display: ReturnType<typeof createDisplay>) => {
    const { cells } = display.ribbonGeometry
    const cell = cells.get('ribbons:1')!
    if (cell.kind !== 'ribbons') {
      throw new Error('ribbons:1 is not a ribbon cell')
    }
    return cell.data
  }
  const starRecords = () => [
    new SimpleFeature({
      uniqueId: 'r1',
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    }),
    new SimpleFeature({
      uniqueId: 'r2',
      refName: 'ctgA',
      start: 200,
      end: 400,
      strand: -1,
      mate: {
        assemblyName: 'volvox_ins',
        refName: 'ctgC',
        start: 1100,
        end: 1300,
      },
    }),
  ]
  const frames = new Map([
    ['volvox_random', decisionOn('ctgB', 200)],
    ['volvox_ins', decisionOn('ctgC', 1200)],
  ])
  const pair = 'volvox_random|volvox_ins'

  test('once the pair fetch has come back empty', () => {
    const display = createDisplay()
    display.setFeatures(starRecords())
    display.setLaneFrames(0, frames)
    expect(display.laneLinksFetchSpecs.map(s => s.lane)).toEqual([pair])
    // nothing composed until the file has been asked
    expect(display.pairLinks.has(pair)).toBe(false)

    display.setLaneLinks(
      new Map([
        [pair, { key: display.laneLinksFetchSpecs[0]!.key, links: [] }],
      ]),
    )
    const composed = display.pairLinks.get(pair)!.links
    expect(composed).toHaveLength(1)
    const [link] = composed
    // the anchor overlap is ctgA:200-300; forward in the upper lane, reversed
    // in the lower, so the link runs crosswise and the lower span is the
    // record's far end
    expect(link!.get('refName')).toBe('ctgB')
    expect([link!.get('start'), link!.get('end')]).toEqual([200, 300])
    expect(link!.get('strand')).toBe(-1)
    expect(link!.get('mate')).toEqual({
      assemblyName: 'volvox_ins',
      refName: 'ctgC',
      start: 1200,
      end: 1300,
    })

    const data = ribbonsBetweenMates(display)
    expect(data.instanceCount).toBe(1)
    const lower = display.laneStack.lanes[2]!
    const [x1, x2] = lower.spanOf('ctgC', 1200, 1300)!
    expect(Math.min(data.bp3[0]!, data.bp4[0]!)).toBe(Math.min(x1, x2))
    expect(Math.max(data.bp3[0]!, data.bp4[0]!)).toBe(Math.max(x1, x2))
    // the composed links owe the export nothing: the pair is fetched
    expect(
      staleLaneSpecs(display.laneLinksFetchSpecs, display.laneLinks),
    ).toEqual([])
  })

  test('without asking, once the header has named the anchor', () => {
    const display = createDisplay()
    display.setFeatures(starRecords())
    display.setLaneFrames(0, frames)
    display.setStarAnchor('volvox')
    expect(display.laneLinksFetchSpecs).toEqual([])
    expect(display.pairLinks.get(pair)!.links).toHaveLength(1)
    expect(ribbonsBetweenMates(display).instanceCount).toBe(1)
  })

  test('a pair the file answers keeps its own records', () => {
    const display = createDisplay()
    display.setFeatures(starRecords())
    display.setLaneFrames(0, frames)
    const direct = new SimpleFeature({
      uniqueId: 'direct',
      refName: 'ctgB',
      start: 150,
      end: 250,
      strand: 1,
      mate: {
        assemblyName: 'volvox_ins',
        refName: 'ctgC',
        start: 1150,
        end: 1250,
      },
    })
    display.setLaneLinks(new Map([[pair, { key: 'k', links: [direct] }]]))
    expect(display.pairLinks.get(pair)!.links).toEqual([direct])
  })
})

// A pangenome graph holds hundreds of haplotypes, and the display learnt its
// lanes from the fetched window alone, so the picker had nothing to offer
// until every lane had been placed at least once. An adapter that declares its
// lanes in its header is read once, like a tiered file's tiers, and its whole
// universe is on offer before any fetch lands; the anchor is never a lane.
test('an adapter declaring its lanes has its header read once, and the universe lists them before any is placed', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    rpc: async (name, args) => {
      calls.push({ name, args })
      return name === 'CoreGetInfo'
        ? {
            hasCoarseTier: false,
            anchorAssemblyName: 'volvox',
            lanes: [
              { name: 'HG1#1', label: 'HG1#1', group: 'HG1' },
              { name: 'HG1#2', group: 'HG1' },
              { name: 'volvox', group: 'volvox' },
              { name: 'HG1#1', group: 'again' },
              { notALane: true },
            ],
          }
        : []
    },
  })
  await when(() => display.declaredLanes !== undefined, { timeout: 5000 })
  expect(calls.filter(c => c.name === 'CoreGetInfo')).toHaveLength(1)
  expect(display.starAnchor).toBe('volvox')
  expect(display.laneUniverse).toEqual([
    { name: 'HG1#1', label: 'HG1#1', group: 'HG1', placed: false },
    { name: 'HG1#2', label: undefined, group: 'HG1', placed: false },
  ])
  expect(display.rowAssemblies).toEqual([])

  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    mateRecord('r1', 'HG1#2'),
    mateRecord('r2', 'sample#1#undeclared'),
  ])
  expect(display.laneUniverse.map(l => [l.name, l.placed])).toEqual([
    ['HG1#1', false],
    ['HG1#2', true],
    ['sample#1#undeclared', true],
  ])
  expect(display.rowAssemblies).toEqual(['HG1#2', 'sample#1#undeclared'])
})

test('an adapter that neither tiers nor declares lanes is never asked for a header', async () => {
  const calls: string[] = []
  const { display } = createDisplayWithSession({
    rpc: async name => {
      calls.push(name)
      return []
    },
  })
  await when(() => display.features !== undefined, { timeout: 5000 })
  expect(calls).not.toContain('CoreGetInfo')
  expect(display.declaredLanes).toBeUndefined()
  expect(display.laneUniverse).toEqual([])
})

// The selection is the reader's picture, so it is display state: it narrows
// the stack the same way after every refetch, a snapshot carries it, and the
// config's `lanes` is what a hosted track opens on until the reader chooses.
test('a lane selection narrows the stack, survives a refetch, and is what the config opens on', () => {
  const display = createDisplay()
  const window = () => [
    mateRecord('r1', 'volvox_random'),
    mateRecord('r2', 'sample#1#a'),
    mateRecord('r3', 'sample#1#b'),
  ]
  display.setFeatures(window())
  expect(display.rowAssemblies).toEqual([
    'volvox_random',
    'sample#1#a',
    'sample#1#b',
  ])
  expect(display.laneSelection).toBeUndefined()

  setConf(display, 'lanes', ['sample#1#b', 'not#placed'])
  expect(display.laneSelection).toEqual(['sample#1#b', 'not#placed'])
  expect(display.rowAssemblies).toEqual(['sample#1#b'])

  display.setSelectedLanes(['sample#1#a', 'volvox_random'])
  expect(display.rowAssemblies).toEqual(['volvox_random', 'sample#1#a'])
  display.setFeatures(window())
  expect(display.rowAssemblies).toEqual(['volvox_random', 'sample#1#a'])
  expect(getSnapshot(display).selectedLanes).toEqual([
    'sample#1#a',
    'volvox_random',
  ])
  // pins and hides still apply inside the selection
  display.setRowOrder(['sample#1#a'])
  expect(display.rowAssemblies).toEqual(['sample#1#a', 'volvox_random'])
  display.setHiddenLanes(['volvox_random'])
  expect(display.rowAssemblies).toEqual(['sample#1#a'])

  display.setSelectedLanes(undefined)
  expect(display.laneSelection).toEqual(['sample#1#b', 'not#placed'])
  expect(getSnapshot(display).selectedLanes).toBeUndefined()
})

// The bug this locks down: `laneSelection` existed and narrowed the DRAWING,
// and nothing passed it to the adapter — so a graph track showing eight lanes
// still fetched all 464 haplotypes and threw away 456 of them. The two halves
// are the term reaching the fetch at all, and the fetch key moving when it
// does, since held data fetched for a different selection is stale.
test('a lane selection reaches the fetch only where the adapter can cut on it', () => {
  // MCScanBlocksAdapter declares no lane universe. A source that cannot answer
  // for a subset more cheaply than for all of it must not be made to refetch
  // for a filter it would ignore, so the selection stays a drawing concern.
  const plain = createDisplay()
  plain.setSelectedLanes(['sample#1#a'])
  expect(plain.laneSelection).toEqual(['sample#1#a'])
  expect(plain.fetchLaneSelection).toBeUndefined()
  expect(plain.rpcProps()).toEqual({ haplotypes: undefined })

  // the graph adapter declares its lanes in its header, which is what earns it
  // the term: it walks the named haplotypes from an anchor instead of naming
  // every one and discarding
  const { display: graph } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
  })
  const everyLane = graph.rpcPropsCacheKey
  expect(graph.fetchLaneSelection).toBeUndefined()

  graph.setSelectedLanes(['HG00097.1', 'HG00099.1'])
  expect(graph.fetchLaneSelection).toEqual(['HG00097.1', 'HG00099.1'])
  expect(graph.rpcProps()).toEqual({
    haplotypes: ['HG00097.1', 'HG00099.1'],
  })
  const eightLanes = graph.rpcPropsCacheKey
  expect(eightLanes).not.toBe(everyLane)

  // a different set is a different fetch, and clearing it comes back to the key
  // the unfiltered window was fetched under rather than to a third state
  graph.setSelectedLanes(['HG00097.1'])
  expect(graph.rpcPropsCacheKey).not.toBe(eightLanes)
  graph.setSelectedLanes(undefined)
  expect(graph.fetchLaneSelection).toBeUndefined()
  expect(graph.rpcPropsCacheKey).toBe(everyLane)
})

test('the track menu offers the picker once there is a choice, and the way back out of a selection', () => {
  const display = createDisplay()
  const labels = () =>
    display.trackMenuItems().map(i => ('label' in i ? i.label : '—'))
  display.setFeatures([mateRecord('r1', 'volvox_random')])
  expect(labels()).not.toContain('Choose lanes...')
  display.setFeatures([
    mateRecord('r1', 'volvox_random'),
    mateRecord('r2', 'sample#1#a'),
  ])
  expect(labels()).toContain('Choose lanes...')
  display.setSelectedLanes(['sample#1#a'])
  expect(labels()).toContain('Every lane (1 chosen)')
})

test('declaredLanesOf reads a header that names lanes and nothing else', () => {
  expect(declaredLanesOf(null)).toEqual([])
  expect(declaredLanesOf({ hasCoarseTier: true })).toEqual([])
  expect(declaredLanesOf({ lanes: 'HG1' })).toEqual([])
  expect(
    declaredLanesOf({ lanes: [{ name: 'HG1#1', label: 3, group: 'HG1' }] }),
  ).toEqual([{ name: 'HG1#1', label: undefined, group: 'HG1' }])
})

// The label table an `attribute:` ribbon mode paints from accumulates across
// fetches in first-seen order, so a pan that brings new labels appends them
// and recolors nothing; picking the mode again re-keys from what is loaded.
test('the ribbon label table accumulates across fetches and resets on a mode pick', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: {
      type: 'MCScanBlocksAdapter',
      attributeColumns: ['group', 'color'],
    },
  })
  const row = (id: string, group: string, color?: string) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      name: id,
      group,
      ...(color ? { color } : {}),
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    })
  display.setRibbonColorBy('attribute:group')
  // `color` is parsed for the labels' palette, never offered as a mode
  expect(display.ribbonColorAttributes).toEqual(['group'])
  display.setFeatures([row('f1', 'B1'), row('f2', 'A1a', '#4DB5E3')])
  expect(display.ribbonLabels).toEqual({
    attribute: 'group',
    labels: ['B1', 'A1a'],
    colors: { A1a: '#4DB5E3' },
  })
  display.setFeatures([row('f3', 'C1'), row('f2', 'A1a')])
  expect(display.ribbonLabels?.labels).toEqual(['B1', 'A1a', 'C1'])
  display.setRibbonColorBy('attribute:group')
  expect(display.ribbonLabels).toBeUndefined()
  display.setFeatures([row('f3', 'C1')])
  expect(display.ribbonLabels?.labels).toEqual(['C1'])
  display.setRibbonColorBy('strand')
  expect(display.ribbonLabels).toBeUndefined()
})

// The fetch asks for the view's static blocks, which reach past the window,
// and `clipToRegion` cuts each record to what was ASKED FOR — so an adapter
// answering one record per lane hands the fit a placement the width of the
// padding. The picture is still drawn from the whole record, since the stack
// is translated between settles and a ribbon cut at the viewport edge would
// end in mid-air on the first pan.
test('the fit sees a record cut to the viewport, the picture sees it whole', () => {
  const display = createDisplay()
  const overhang = new SimpleFeature({
    uniqueId: 'r1',
    refName: 'ctgA',
    start: 0,
    end: 1000,
    strand: 1,
    mate: {
      assemblyName: 'volvox_random',
      refName: 'ctgB',
      start: 5000,
      end: 6000,
    },
  })
  display.setFeatures([overhang])
  expect(display.lgv.settledDynamicBlocks.map(b => [b.start, b.end])).toEqual([
    [0, 800],
  ])
  expect(display.visibleGroups.map(g => g.mates.get('volvox_random'))).toEqual([
    [{ refName: 'ctgB', start: 5000, end: 6000, orientation: 1 }],
  ])
  expect(display.fitGroups.map(g => g.mates.get('volvox_random'))).toEqual([
    [{ refName: 'ctgB', start: 5000, end: 5800, orientation: 1 }],
  ])
  expect(display.fitGroups.map(g => g.anchor)).toEqual([
    { refName: 'ctgA', start: 0, end: 800 },
  ])
})
