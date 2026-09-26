import { readConfObject, setConf } from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { SimpleFeature } from '@jbrowse/core/util'
import {
  NO_VALUE_LABEL,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { takeSnackbarAction, testAssembly } from '@jbrowse/display-test-utils'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { declaredLanesOf } from '@jbrowse/synteny-core'
import { autorun, when } from 'mobx'

import { LaneGene } from './geneGlyph.ts'
import { specsCoverMate, staleLaneSpecs } from './laneFetch.ts'
import { laneResetLabel } from './laneSelection.ts'
import { MIN_LANE_PITCH } from './laneStack.ts'
import { lanesMenuItem } from './menus.ts'
import { createDisplay, createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'

const geneKeyOf = (display: MultiWaySyntenyDisplayModel) => {
  const scale = display.colorScales.find(s => s.id === 'genes')
  return scale?.kind === 'categorical' ? scale.entries : []
}

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
test('a spec list covers a mate lane when one of its specs is a mate lane', () => {
  const spec = (lane: string) => ({ lane, key: lane })
  // an anchor without a gene track has no spec of its own, so a window
  // framing one mate is a single spec that is a mate's
  expect(specsCoverMate([spec('peach')], 'grape')).toBe(true)
  expect(specsCoverMate([spec('grape')], 'grape')).toBe(false)
  expect(specsCoverMate([spec('grape'), spec('peach')], 'grape')).toBe(true)
  expect(specsCoverMate([], 'grape')).toBe(false)
})

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

// The genes wait again on a new anchor, and a re-anchor frames other pairs, so
// the links do too
test('a re-anchor waits for its lane links again', () => {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: ['volvox', 'volvox_random', 'volvox_ins'],
    geneTracks: [],
  })
  const onto = (anchor: string, mates: [string, string]) => {
    display.lgv.setDisplayedRegions([
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: anchor },
    ])
    display.setFeatures(
      mates.map(
        mate =>
          new SimpleFeature({
            uniqueId: `${anchor}-${mate}`,
            refName: 'ctgA',
            start: 100,
            end: 300,
            strand: 1,
            mate: { assemblyName: mate, refName: 'ctgB', start: 100, end: 300 },
          }),
      ),
      anchor,
    )
    display.setLaneFrames(
      0,
      new Map(mates.map(mate => [mate, decisionOn('ctgB', 200)])),
    )
    expect(display.laneLinksFetchSpecs).toHaveLength(1)
  }
  const land = () => {
    const [spec] = display.laneLinksFetchSpecs
    display.setLaneLinks(new Map([[spec!.lane, { key: spec!.key, links: [] }]]))
  }

  onto('volvox', ['volvox_random', 'volvox_ins'])
  expect(display.awaitingDependentData).toBe(true)
  land()
  expect(display.awaitingDependentData).toBe(false)

  onto('volvox_random', ['volvox', 'volvox_ins'])
  expect(display.awaitingDependentData).toBe(true)
  land()
  expect(display.awaitingDependentData).toBe(false)
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
    orientationPinned: false,
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
  expect(
    display.pairLinks.get('volvox_random|sample#1#undeclared')?.links.length,
  ).toBeGreaterThan(0)

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

test('the track menu ends with the stacked-synteny launcher under Launch', () => {
  const display = createDisplay()
  const items = display.trackMenuItems()
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Show...',
    'Color by...',
    'Lanes',
    'Launch',
  ])
  const launch = items.at(-1)
  const subMenu = launch && 'subMenu' in launch ? resolveSubMenu(launch) : []
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
  const entries = geneKeyOf(display)
  expect(entries.map(i => i.label)).toEqual(['atpA', 'atpB'])
  expect(new Set(entries.map(i => i.color)).size).toBe(2)
  expect(display.colorScales.map(s => s.id)).toEqual(['genes'])
  expect(display.hasLegendKey).toBe(true)
})

// The default `color` slot is one color for every gene, which keys nothing: a
// box of identical swatches spends the reader's attention to say the display
// has a color, so `hasLegendKey` takes the Show legend row off with it.
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
  expect(geneKeyOf(display)).toEqual([])
  expect(display.hasLegendKey).toBe(false)
})

function anchorGenes(display: MultiWaySyntenyDisplayModel, genes: LaneGene[]) {
  display.setLaneGenes(
    new Map([['volvox', { key: display.laneGenesFetchSpecs[0]!.key, genes }]]),
    undefined,
  )
}

function anchorGeneFills(display: MultiWaySyntenyDisplayModel) {
  const cell = display.laneGlyphCells.get('glyphs:0')
  return cell?.kind === 'glyphs'
    ? cell.data.hits.map(h => [h.feature.id(), h.fill?.css])
    : []
}

// The color object's shorthand: a bare string, `jexl:` included, is its
// `value`, and an unset `value` still paints the goldenrod the plain slot had
test('a color string paints through the channel, and unset is goldenrod', () => {
  const display = createDisplay()
  anchorGenes(display, [namedGene('g1', 'atpA', 100, 300)])
  expect(anchorGeneFills(display)).toEqual([['g1', 'goldenrod']])

  setConf(display, 'color', "jexl:feature.name == 'atpA' ? 'red' : 'blue'")
  expect(display.geneColorField).toBe('')
  expect(anchorGeneFills(display)).toEqual([['g1', 'red']])
})

// `cluster` is the group a gene stands in for, decided before its fill is
// packed; a gene no placement overlaps carries no group and paints the
// channel's no-value grey, and the key lists both
test('cluster paints a gene by the group it carries', () => {
  const display = createDisplay()
  display.setFeatures([mateRecord('own1', 'volvox_random', 'gene1')])
  anchorGenes(display, [
    namedGene('g1', 'atpA', 120, 280),
    namedGene('g2', 'atpB', 500, 600),
  ])
  display.setGeneColorBy('cluster')
  expect(display.geneColorField).toBe('cluster')
  const field = categoricalField('cluster')
  expect(anchorGeneFills(display)).toEqual([
    ['g1', field.color('gene1')],
    ['g2', NO_CATEGORY_COLOR],
  ])
  expect(geneKeyOf(display).map(e => e.label)).toEqual([
    'gene1',
    NO_VALUE_LABEL,
  ])
})

// Default goes back to the configured value and keeps the field for the way
// back; re-picking the field keeps the order it had
test('Default keeps the field, and the field keeps its order', () => {
  const display = createDisplay()
  setConf(display, 'color', { value: 'red', field: 'name', domain: ['atpA'] })
  display.setGeneColorBy('')
  expect(display.geneColorField).toBe('')
  expect(display.geneColorSettings.color).toMatchObject({
    value: 'red',
    field: 'name',
    scale: 'none',
    domain: ['atpA'],
  })
  display.setGeneColorBy('name')
  expect(display.geneColorSettings.color).toMatchObject({
    value: 'red',
    field: 'name',
    scale: undefined,
    domain: ['atpA'],
  })
  display.setGeneColorBy('strand')
  expect(display.geneColorSettings.color).toMatchObject({
    value: 'red',
    field: 'strand',
    domain: [],
  })
})

test('Pin distinct colors writes the keyed values into the domain', () => {
  const display = createDisplay()
  anchorGenes(display, [
    namedGene('g1', 'atpA', 100, 300),
    namedGene('g2', 'atpB', 400, 600),
  ])
  display.setGeneColorBy('name')
  expect(display.pinnedGeneColorDomain).toEqual(['atpA', 'atpB'])
  display.pinGeneColorDomain()
  expect(display.geneColorDomain).toEqual(['atpA', 'atpB'])
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

  display.setRibbonColorField('strand')
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

test('re-anchoring on a lane drawn [rev] reverses the view', async () => {
  const { display, session } = createDisplayWithSession()
  display.reanchor('volvox_random', 'ctgA:1..100[rev]')
  for (let i = 0; i < 50 && !session.notifications.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(display.anchorReversed).toBe(true)
})

// rowAssemblies narrows to the selection and the anchor is never a lane, so
// the genome a re-anchor moves out of the anchor lane fell outside a selection
// that had no reason to name it, and vanished from the stack
test('re-anchoring under a lane selection keeps the outgoing anchor drawn', async () => {
  const { display, session } = createDisplayWithSession()
  display.setSelectedLanes(['volvox_random'])
  display.reanchor('volvox_random', 'ctgA:1-100')
  for (let i = 0; i < 50 && !session.notifications.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(session.notifications.at(-1)?.message).toBe(
    'Re-anchored on volvox_random',
  )
  expect(display.laneFilter).toEqual({ only: ['volvox_random', 'volvox'] })
})

test('with every lane drawn, re-anchoring writes no selection', async () => {
  const { display, session } = createDisplayWithSession()
  display.reanchor('volvox_random', 'ctgA:1-100')
  for (let i = 0; i < 50 && !session.notifications.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(session.notifications).toHaveLength(1)
  expect(display.laneFilter).toBeUndefined()
})

// A genome hidden as a mate lane stays hidden while it is the anchor, so
// re-anchoring away from it has to unhide it
test('re-anchoring unhides the outgoing anchor', async () => {
  const { display, session } = createDisplayWithSession()
  display.hideLane('volvox')
  display.reanchor('volvox_random', 'ctgA:1-100')
  for (let i = 0; i < 50 && !session.notifications.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(session.notifications.at(-1)?.message).toBe(
    'Re-anchored on volvox_random',
  )
  expect(display.laneFilter).toBeUndefined()
})

// The clicked ribbon keeps an outline the way the pairwise view's does: the
// click records the hover's target by key, and only an empty-canvas click lets
// it go. hoverRelayout.test.ts pins what the key resolves to.
test('a ribbon click holds its key until a click on empty canvas', () => {
  const display = createDisplay()
  const feature = new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 100,
    end: 300,
  })
  display.setHoverTarget({ label: 'link', feature, linkId: 'f1' })
  display.selectHovered()
  expect(display.clickedTarget).toEqual({ groupKey: undefined, linkId: 'f1' })

  // the pointer leaving does not release it
  display.setHoverTarget(undefined)
  expect(display.clickedTarget?.linkId).toBe('f1')

  // a stationary click on empty canvas does
  display.selectHovered()
  expect(display.clickedTarget).toBeUndefined()

  // a refetch does not, since the click's own widget resizes the view and
  // that refetches
  display.setHoverTarget({ label: 'g', feature, groupKey: 'g1' })
  display.selectHovered()
  display.setFeatures([])
  expect(display.clickedTarget).toEqual({ groupKey: 'g1', linkId: undefined })
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
            orientationPinned: false,
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

// A selection recoloured its glyph through `laneGlyphCells`, so a click
// repacked and re-uploaded every lane. The chrome draws it now, off the cells'
// hit boxes, and no selection — this display's or another track's — touches
// the cells.
test('a selection lights the chrome and leaves the lane glyph cells alone', () => {
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
  expect(display.selectionInk).toEqual([])
  expect(display.laneGlyphCells).toBe(before)

  session.setSelection(display.features![0]!)
  expect(display.selectionInk).not.toEqual([])
  expect(display.laneGlyphCells).toBe(before)
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
  orientationPinned: false,
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
    expect(before?.view).toMatch(/\|fine$/)

    display.setLodMode('coarse')
    expect(display.lodTier).toBe('coarse')
    expect(display.currentFetchKey).not.toEqual(before)
    expect(display.currentFetchKey?.view).toMatch(/\|coarse$/)
    expect(menuLabels(display)).toContain('Level of detail')
  })

  test('a file with no coarse tier resolves fine under a pinned coarse', () => {
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'PairwiseIndexedPAFAdapter' },
    })
    display.setLodMode('coarse')
    display.setAdapterHeader({
      adapterConfig: display.adapterConfig,
      value: { hasCoarseTier: false },
    })
    expect(display.lodTier).toBe('fine')
  })

  test('a gene table has no tiers: no menu item, and a mode change moves nothing', () => {
    const display = createDisplay()
    expect(display.hasLodCapableAdapter).toBe(false)
    expect(menuLabels(display)).not.toContain('Level of detail')
    const before = display.currentFetchKey
    display.setLodMode('coarse')
    expect(display.lodTier).toBe('fine')
    expect(display.currentFetchKey).toEqual(before)
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
      // a header naming no star anchor: every gutter is a direct pair
      keepAlignment: true,
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
// depends on the feature and the config, never on the frame.
test('a settle rebuilds the lane cells against the same fills', () => {
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
  const stop = autorun(() => [
    display.laneGeneColors,
    display.boxColors,
    display.laneGlyphCells,
  ])
  const genes = display.laneGeneColors.get('volvox')
  const boxes = display.boxColors
  const cells = display.laneGlyphCells

  display.setLaneFrames(
    37,
    new Map([['volvox_random', decisionOn('ctgB', 200)]]),
  )
  expect(display.laneGlyphCells).not.toBe(cells)
  expect(display.laneGeneColors.get('volvox')).toBe(genes)
  expect(display.boxColors).toBe(boxes)

  // a gene commit is what a lane's fills are keyed on, and an ortholog
  // commit the boxes'
  display.setLaneGenes(
    new Map([['volvox', { key: 'later', genes: [] }]]),
    undefined,
  )
  expect(display.laneGeneColors.get('volvox')).not.toBe(genes)
  display.setFeatures([mateRecord('own2', 'volvox_random', 'gene2')])
  expect(display.boxColors).not.toBe(boxes)
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

// A hub config carries several gene sets per genome in one adapter format, so
// the rank ties and declaration order picked `hg38-ccdsGene` over RefSeq.
test('a lane draws the gene track the display names for its genome', () => {
  const { display, session } = createDisplayWithSession({
    geneTracks: [
      { trackId: 'volvox_genes', assemblyNames: ['volvox'] },
      { trackId: 'volvox_refseq', assemblyNames: ['volvox'] },
      { trackId: 'volvox_random_ccds', assemblyNames: ['volvox_random'] },
      { trackId: 'volvox_random_refseq', assemblyNames: ['volvox_random'] },
    ],
  })
  display.setFeatures([mateRecord('f1', 'volvox_random', 'gene1')])
  const anchorKey = () =>
    display.laneGenesFetchSpecs.find(spec => spec.lane === 'volvox')?.key
  const trackIdOf = (lane: string) => {
    const track = display.laneGeneTracks.get(lane)
    return track && readConfObject(track, 'trackId')
  }
  expect(trackIdOf('volvox_random')).toBe('volvox_random_ccds')

  setConf(display, 'laneGeneTracks', ['volvox_random_refseq'])
  expect(trackIdOf('volvox_random')).toBe('volvox_random_refseq')
  expect(trackIdOf('volvox')).toBe('volvox_genes')

  // genes held under one track are stale once the lane names another
  const held = anchorKey()
  setConf(display, 'laneGeneTracks', ['volvox_random_refseq', 'volvox_refseq'])
  expect(trackIdOf('volvox')).toBe('volvox_refseq')
  expect(anchorKey()).not.toBe(held)

  display.openInNewView('volvox_random', 'ctgA:1-100')
  expect(session.addedViews.map(view => view.init.tracks)).toEqual([
    ['multiway_track', 'volvox_random_refseq'],
  ])
})

// The adapter compares its config's own spelling of a lane, and the worker
// has no assembly manager, so a track naming a lane by an alias asked for a
// lane the source never heard of
test('a lane selection reaches the adapter under every name the session knows the genome by', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    assemblyOf: name =>
      testAssembly(
        name === 'volvox_random'
          ? { allAliases: ['volvox_random', 'vr', 'volvox#2'] }
          : {},
      ),
  })
  expect(display.fetchLaneSelection).toEqual([
    'volvox_random',
    'vr',
    'volvox#2',
  ])
})

test('two mates spelling one assembly two ways both draw from its one gene track', () => {
  const { display } = createDisplayWithSession({
    geneTracks: [
      { trackId: 'volvox_genes', assemblyNames: ['volvox'] },
      { trackId: 'volvox_random_genes', assemblyNames: ['volvox_random'] },
    ],
    assemblyAliases: { 'sample#1#vr': 'volvox_random' },
  })
  display.setFeatures([
    mateRecord('f1', 'volvox_random', 'gene1'),
    mateRecord('f2', 'sample#1#vr', 'gene2'),
  ])
  expect([...display.laneGeneAdapters.keys()]).toEqual([
    'volvox',
    'volvox_random',
    'sample#1#vr',
  ])
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
    display.setAdapterHeader({
      adapterConfig: display.adapterConfig,
      value: { anchorAssemblyName: 'volvox' },
    })
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
  expect(display.laneUniverse.map(({ placed: _, ...lane }) => lane)).toEqual([
    { name: 'HG1#1', label: 'HG1#1', group: 'HG1', drawn: false },
    { name: 'HG1#2', label: undefined, group: 'HG1', drawn: false },
    { name: 'volvox_random', drawn: true },
  ])
  expect(display.laneUniverse.slice(0, 2).map(lane => lane.placed)).toEqual([
    undefined,
    undefined,
  ])
  expect(display.rowAssemblies).toEqual([])

  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures(
    [mateRecord('r1', 'HG1#2'), mateRecord('r2', 'sample#1#undeclared')],
    'volvox',
    display.fetchLaneSelection,
  )
  // the fetch asked only for the track's lane, so the window says nothing of
  // HG1#1, which a picker would otherwise grey as placing nothing
  expect(display.laneUniverse.map(l => [l.name, l.placed])).toEqual([
    ['HG1#1', undefined],
    ['HG1#2', true],
    ['volvox_random', false],
    ['sample#1#undeclared', true],
  ])
  // the track names volvox_random, so that is the lane the stack opens on
  expect(display.rowAssemblies).toEqual([])
  display.setSelectedLanes(['HG1#2', 'sample#1#undeclared'])
  expect(display.rowAssemblies).toEqual(['HG1#2', 'sample#1#undeclared'])
})

test('an adapter that neither tiers nor declares lanes is never asked for a header, and offers the genomes its track names', async () => {
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
  expect(display.laneUniverse).toEqual([
    { name: 'volvox_random', placed: false, drawn: true },
  ])
})

// A hide with no choice in force takes one lane out and nothing else, so a lane
// no config or header names still draws when a pan first places it
test('hiding a lane leaves every other lane drawn, including ones placed later', () => {
  const display = createDisplay()
  display.setFeatures([
    mateRecord('r1', 'sample#1#a'),
    mateRecord('r2', 'sample#1#b'),
  ])
  display.hideLane('sample#1#a')
  expect(display.hiddenLanes).toEqual(['sample#1#a'])
  expect(
    display.laneUniverse.map(lane => [lane.name, lane.drawn]),
  ).toContainEqual(['sample#1#a', false])
  expect(display.rowAssemblies).toEqual(['sample#1#b'])
  display.setFeatures([
    mateRecord('r1', 'sample#1#a'),
    mateRecord('r2', 'sample#1#b'),
    mateRecord('r3', 'sample#1#c'),
  ])
  expect(display.rowAssemblies).toEqual(['sample#1#b', 'sample#1#c'])
  display.showLane('sample#1#a')
  expect(display.laneFilter).toBeUndefined()
})

// A graph refetch walks the haplotypes over the network, and a hide changes
// only what is drawn
test('hiding a lane on a graph track refetches nothing', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    trackAssemblyNames: ['volvox', 'HG00097.1', 'HG00099.1'],
  })
  display.setFeatures([
    mateRecord('r1', 'HG00097.1'),
    mateRecord('r2', 'HG00099.1'),
  ])
  const key = display.settingsFetchInputs
  display.hideLane('HG00097.1')
  expect(display.rowAssemblies).toEqual(['HG00099.1'])
  expect(display.settingsFetchInputs).toEqual(key)
})

// A picker choice in force is also what a graph track fetches, so a hide has
// to leave it alone: it takes the lane out of the drawing only
test('hiding a lane under a picker choice keeps the choice and refetches nothing', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    trackAssemblyNames: ['volvox', 'HG00097.1'],
  })
  display.setAdapterHeader({
    adapterConfig: display.adapterConfig,
    value: { lanes: [{ name: 'HG00097.1' }, { name: 'HG00099.1' }] },
  })
  display.setFeatures([
    mateRecord('r1', 'HG00097.1'),
    mateRecord('r2', 'HG00099.1'),
  ])
  display.chooseLanes(['HG00097.1', 'HG00099.1'])
  const key = display.settingsFetchInputs
  display.hideLane('HG00097.1')
  expect(display.laneFilter).toEqual({
    only: ['HG00097.1', 'HG00099.1'],
    except: ['HG00097.1'],
  })
  expect(display.rowAssemblies).toEqual(['HG00099.1'])
  expect(display.settingsFetchInputs).toEqual(key)
  display.showLane('HG00097.1')
  expect(display.laneFilter).toEqual({ only: ['HG00097.1', 'HG00099.1'] })
  expect(display.rowAssemblies).toEqual(['HG00097.1', 'HG00099.1'])
})

describe('the picker submit', () => {
  const lanes = () => [
    mateRecord('r1', 'volvox_random'),
    mateRecord('r2', 'sample#1#a'),
  ]

  test('every lane ticked writes no choice, so later lanes are not shut out', () => {
    const display = createDisplay()
    display.setFeatures(lanes())
    display.hideLane('sample#1#a')
    display.chooseLanes(['volvox_random', 'sample#1#a'])
    expect(display.laneFilter).toBeUndefined()
    display.chooseLanes(['sample#1#a'])
    expect(display.laneFilter).toEqual({ only: ['sample#1#a'] })
  })

  // No choice over a track naming its own lanes means those lanes, so every
  // lane ticked has to be written out, and ticking exactly those writes none
  test("over a track naming its lanes, every lane is written out and the track's own are no choice", () => {
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
      trackAssemblyNames: ['volvox', 'HG00097.1'],
    })
    display.setAdapterHeader({
      adapterConfig: display.adapterConfig,
      value: { lanes: [{ name: 'HG00097.1' }, { name: 'HG00099.1' }] },
    })
    display.chooseLanes(['HG00097.1', 'HG00099.1'])
    expect(display.laneFilter).toEqual({ only: ['HG00097.1', 'HG00099.1'] })
    display.chooseLanes(['HG00097.1'])
    expect(display.laneFilter).toBeUndefined()
  })

  test('a chosen lane this window does not place survives', () => {
    const display = createDisplay()
    display.setFeatures(lanes())
    display.setSelectedLanes(['volvox_random', 'far#1#away'])
    display.chooseLanes(['sample#1#a'])
    expect(display.laneFilter).toEqual({ only: ['sample#1#a', 'far#1#away'] })
  })
})

// A star's mate lanes are aligned to its anchor only, and a graph source
// declaring its haplotypes without the reference answers from the reference
// alone: re-anchored on a mate, either draws next to nothing
test('a mate lane can become the anchor only on a source that aligns lanes to each other', () => {
  const plain = createDisplay()
  expect(plain.canReanchor).toBe(true)
  plain.setAdapterHeader({
    adapterConfig: plain.adapterConfig,
    value: { anchorAssemblyName: 'volvox' },
  })
  expect(plain.canReanchor).toBe(false)

  const graph = createDisplay()
  graph.setAdapterHeader({
    adapterConfig: graph.adapterConfig,
    value: { lanes: [{ name: 'HG1#1' }, { name: 'HG1#2' }] },
  })
  expect(graph.canReanchor).toBe(false)
  graph.setAdapterHeader({
    adapterConfig: graph.adapterConfig,
    value: { lanes: [{ name: 'HG1#1' }, { name: 'volvox' }] },
  })
  expect(graph.canReanchor).toBe(true)
})

// The selection is the reader's picture, so it is display state: it narrows
// the stack the same way after every refetch and a snapshot carries it.
test('a lane selection narrows the stack and survives a refetch', () => {
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

  display.setSelectedLanes(['sample#1#a', 'volvox_random'])
  expect(display.rowAssemblies).toEqual(['volvox_random', 'sample#1#a'])
  display.setFeatures(window())
  expect(display.rowAssemblies).toEqual(['volvox_random', 'sample#1#a'])
  expect(getSnapshot(display).laneFilter).toEqual({
    only: ['sample#1#a', 'volvox_random'],
  })
  // pins apply inside the selection, and a hide takes a lane out of the
  // drawing without rewriting the choice
  display.setDomain(['sample#1#a'])
  expect(display.rowAssemblies).toEqual(['sample#1#a', 'volvox_random'])
  display.hideLane('volvox_random')
  expect(display.rowAssemblies).toEqual(['sample#1#a'])
  expect(display.laneFilter).toEqual({
    only: ['sample#1#a', 'volvox_random'],
    except: ['volvox_random'],
  })

  display.setSelectedLanes(undefined)
  expect(display.laneSelection).toBeUndefined()
  expect(getSnapshot(display).laneFilter).toBeUndefined()
})

// A graph names 464 haplotypes and its track names the eight the session
// loads, so a GBZ config lists its lanes once, in the track's assemblyNames.
test('a graph track opens on its own assemblies beside the anchor', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    trackAssemblyNames: ['volvox', 'HG00097.1', 'HG00099.1'],
  })
  expect(display.laneSelection).toEqual(['HG00097.1', 'HG00099.1'])
  expect(display.rpcProps()).toEqual({
    haplotypes: ['HG00097.1', 'HG00099.1'],
  })
  display.setSelectedLanes(['HG00097.1'])
  expect(laneResetLabel(display)).toBe("Show the track's lanes (2)")
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
    trackAssemblyNames: ['volvox'],
  })
  const everyLane = graph.settingsFetchInputs
  expect(graph.fetchLaneSelection).toBeUndefined()

  graph.setSelectedLanes(['HG00097.1', 'HG00099.1'])
  expect(graph.fetchLaneSelection).toEqual(['HG00097.1', 'HG00099.1'])
  expect(graph.rpcProps()).toEqual({
    haplotypes: ['HG00097.1', 'HG00099.1'],
  })
  const eightLanes = graph.settingsFetchInputs
  expect(eightLanes).not.toEqual(everyLane)

  // a different set is a different fetch, and clearing it comes back to the key
  // the unfiltered window was fetched under rather than to a third state
  graph.setSelectedLanes(['HG00097.1'])
  expect(graph.settingsFetchInputs).not.toEqual(eightLanes)
  graph.setSelectedLanes(undefined)
  expect(graph.fetchLaneSelection).toBeUndefined()
  expect(graph.settingsFetchInputs).toEqual(everyLane)
})

test('the track menu offers the picker once there is a choice, and the way back out of a selection', () => {
  const display = createDisplay()
  const labels = () =>
    lanesMenuItem(display).subMenu.map(i => ('label' in i ? i.label : '—'))
  display.setFeatures([mateRecord('r1', 'volvox_random')])
  expect(labels()).not.toContain('Choose lanes...')
  display.setFeatures([
    mateRecord('r1', 'volvox_random'),
    mateRecord('r2', 'sample#1#a'),
  ])
  expect(labels()).toContain('Choose lanes...')
  display.setSelectedLanes(['sample#1#a'])
  expect(labels()).toContain('Show every lane (2)')
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
test('the ribbon label table accumulates across fetches and re-keys on a mode pick', () => {
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
  display.setRibbonColorField('group')
  // `color` is parsed for the labels' palette, never offered as a mode
  expect(display.ribbonColorAttributes).toEqual(['group'])
  const group = () => display.ribbonAttributeRanges.group
  display.setFeatures([row('f1', 'B1'), row('f2', 'A1a', '#4DB5E3')])
  expect(group()).toEqual({
    labels: ['B1', 'A1a'],
    colors: { A1a: '#4DB5E3' },
  })
  display.setFeatures([row('f3', 'C1'), row('f2', 'A1a')])
  expect(group()).toEqual({
    labels: ['B1', 'A1a', 'C1'],
    colors: { A1a: '#4DB5E3' },
  })
  display.setRibbonColorField('group')
  expect(group()).toEqual({ labels: ['C1', 'A1a'], colors: {} })
})

// A label's color is its position in the table, so the domain has to move the
// table itself: the key and the ribbons then read the same order.
test('a ribbonColorDomain moves the label table, and the key with it', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: {
      type: 'MCScanBlocksAdapter',
      attributeColumns: ['group'],
    },
  })
  const row = (id: string, group: string) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      name: id,
      group,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    })
  const labels = () => {
    const range = display.ribbonAttributeRanges.group
    return range && 'labels' in range ? range.labels : []
  }
  display.setRibbonColorField('group')
  display.setFeatures([row('f1', 'B1'), row('f2', 'A1a'), row('f3', 'C1')])
  expect(labels()).toEqual(['B1', 'A1a', 'C1'])

  display.setRibbonColorDomain(['C1'])
  expect(labels()).toEqual(['C1', 'A1a', 'B1'])
  const ribbons = display.colorScales.find(scale => scale.id === 'ribbons')
  expect(
    ribbons?.kind === 'categorical' ? ribbons.entries.map(e => e.label) : [],
  ).toEqual(['C1', 'A1a', 'B1'])
})

// The Color by menu picks a synteny mode; the config holds the object. A
// scheme lands as its scale with the column and its order kept unread, so
// picking the column again finds them; re-picking the same column keeps its
// order, and a new one starts from none.
test('a picked ribbon mode is written as the ribbonColor object', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: {
      type: 'MCScanBlocksAdapter',
      attributeColumns: ['group'],
    },
  })
  const ribbonColor = () => getSnapshot(display.configuration.ribbonColor)
  display.configuration.setSubschema('ribbonColor', 'grey')
  display.setRibbonColorField('group')
  display.setRibbonColorDomain(['C1'])
  display.setRibbonColorField('group')
  expect(ribbonColor()).toEqual({
    value: 'grey',
    field: 'group',
    domain: ['C1'],
  })
  display.setRibbonColorField('')
  expect(ribbonColor()).toEqual({
    value: 'grey',
    field: 'group',
    domain: ['C1'],
    scale: 'none',
  })
  expect(display.ribbonColorField).toBe('')
  expect(display.ribbonColor).toBe('grey')
  display.setRibbonColorField('group')
  expect(display.ribbonColorField).toBe('group')
  expect(display.ribbonColorDomain).toEqual(['C1'])
  display.setRibbonColorField('strand')
  expect(ribbonColor()).toEqual({ value: 'grey', field: 'strand' })
  expect(display.ribbonColorField).toBe('strand')
  display.setRibbonColorField('mapq')
  expect(ribbonColor()).toEqual({ value: 'grey', field: 'mapq' })
  expect(display.ribbonColorField).toBe('mapq')
  display.setRibbonColorField('other')
  expect(ribbonColor()).toEqual({ value: 'grey', field: 'other' })
})

test('a ribbonColor field is a preset or a column, scale none parks it, and a palette is refused', () => {
  const { display } = createDisplayWithSession({
    syntenyAdapter: {
      type: 'MCScanBlocksAdapter',
      attributeColumns: ['group'],
    },
  })
  display.configuration.setSubschema('ribbonColor', { field: 'group' })
  expect(display.ribbonColorField).toBe('group')
  expect(() =>
    display.configuration.setSubschema('ribbonColor', {
      field: 'group',
      palette: ['red'],
    }),
  ).toThrow('RibbonColor takes value, field, scale and domain, not palette')
  for (const field of ['strand', 'identity', 'mapq', 'dnds']) {
    display.configuration.setSubschema('ribbonColor', { field })
    expect(display.ribbonColorField).toBe(field)
  }
  display.configuration.setSubschema('ribbonColor', {
    field: 'group',
    scale: 'none',
  })
  expect(display.ribbonColorField).toBe('')
  expect(() =>
    display.configuration.setSubschema('ribbonColor', { scale: 'strand' }),
  ).toThrow()
})

test('identity ribbons key their ramp only when a record carries an identity', () => {
  const display = createDisplay()
  display.setRibbonColorField('identity')
  display.setFeatures([mateRecord('r1', 'volvox_random')])
  expect(display.colorScales.map(scale => scale.id)).toEqual([])
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'r2',
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      identity: 0.93,
      mate: {
        assemblyName: 'volvox_random',
        refName: 'ctgB',
        start: 100,
        end: 300,
      },
    }),
  ])
  expect(display.colorScales.map(scale => [scale.id, scale.kind])).toEqual([
    ['ribbons', 'ramp'],
  ])
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
