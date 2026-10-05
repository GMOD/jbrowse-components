import { parseCigar2 } from '@jbrowse/cigar-utils'
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
import {
  categoricalColor,
  declaredLanesOf,
  resolveCategoricalMode,
} from '@jbrowse/synteny-core'
import { autorun, when } from 'mobx'

import { KIND_BASE } from '../LinearSyntenyRPC/syntenyKinds.ts'
import { NO_OPS } from './alignmentOps.ts'
import { LaneGene } from './geneGlyph.ts'
import { decideLaneFrames, frameFromDecision } from './laneDecision.ts'
import {
  landLaneFetch,
  laneFetchAwaits,
  specsCoverMate,
  staleLaneSpecs,
} from './laneFetch.ts'
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

test('the text slot picks what a gene label prints, name-else-ID unset', () => {
  const display = createDisplay()
  const gene = new SimpleFeature({
    uniqueId: 'u1',
    refName: 'ctgA',
    start: 0,
    end: 10,
    id: 'gene-1',
    gene_name: 'ABC1',
  })
  expect(display.geneTextOf(gene)).toBe('gene-1')
  display.setGeneTextField('gene_name')
  expect(display.geneTextOf(gene)).toBe('ABC1')
  display.setGeneTextField("jexl:get(feature,'gene_name') + '*'")
  expect(display.geneTextOf(gene)).toBe('ABC1*')
  display.setGeneTextField('product')
  expect(display.geneTextOf(gene)).toBeUndefined()
})

test('a text expression that does not compile falls back to name-else-ID', () => {
  const display = createDisplay()
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  display.setGeneTextField("jexl:get(feature,'gene_name'")
  const gene = new SimpleFeature({
    uniqueId: 'u1',
    refName: 'ctgA',
    start: 0,
    end: 10,
    id: 'gene-1',
  })
  expect(display.geneTextOf(gene)).toBe('gene-1')
  expect(() => display.laneGeneLabels('sans-serif')).not.toThrow()
  expect(error).toHaveBeenCalled()
  error.mockRestore()
})

test('the lane fetch is part of loading only until it first lands', () => {
  const display = createDisplay()
  // the harness mounts no canvas; the paint half of loading is the mixin's
  display.markCanvasDrawn()
  const [anchor] = display.laneGenesFetchSpecs
  expect(anchor).toBeDefined()
  expect(display.displayPhase).toBe('loading')

  display.setLaneGenes(
    new Map([[anchor!.lane, { key: anchor!.key, genes: [] }]]),
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(display.displayPhase).toBe('ready')

  // the pan's refetch
  display.setLaneGenes(
    new Map([[anchor!.lane, { key: 'a-later-window', genes: [] }]]),
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(display.displayPhase).toBe('ready')
})

test('a spec list covers a mate lane when one of its specs is a mate lane', () => {
  const spec = (lane: string) => ({ lane, key: lane, assemblyName: lane })
  // an anchor without a gene track has no spec of its own
  expect(specsCoverMate([spec('peach')], 'grape')).toBe(true)
  expect(specsCoverMate([spec('grape')], 'grape')).toBe(false)
  expect(specsCoverMate([spec('grape'), spec('peach')], 'grape')).toBe(true)
  expect(specsCoverMate([], 'grape')).toBe(false)
})

test('the first landing that counts is the one covering a mate lane', () => {
  const display = createDisplay()
  const anchor = display.anchorAssemblyName
  const own = { lane: anchor, key: 'k', assemblyName: anchor }
  const mate = { lane: 'peach', key: 'k', assemblyName: 'peach' }
  display.setLaneGenes(new Map(), [own], anchor)
  expect(display.laneGenes.landedFor).toBeUndefined()
  display.setLaneGenes(new Map(), [own, mate], anchor)
  expect(display.laneGenes.landedFor).toBe(anchor)
  display.setLaneGenes(new Map(), [own], anchor)
  expect(display.laneGenes.landedFor).toBe(anchor)
})

test('a run landing after a re-anchor covers the anchor it was asked under', () => {
  const display = createDisplay()
  const specs = [{ lane: 'cacao', key: 'k', assemblyName: 'cacao' }]
  display.setLaneGenes(new Map(), specs, 'grape')
  expect(display.laneGenes.landedFor).toBe('grape')
  expect(laneFetchAwaits(display.laneGenes, specs, 'peach', false)).toBe(true)
  expect(laneFetchAwaits(display.laneGenes, specs, 'grape', false)).toBe(false)
})

test('a commit keeps only the lanes its specs still name', () => {
  const state = landLaneFetch(
    { held: new Map([['gone', { key: 'old' }]]) },
    new Map([['peach', { key: 'k' }]]),
    [{ lane: 'peach', key: 'k', assemblyName: 'peach' }],
    'grape',
  )
  expect([...state.held!.keys()]).toEqual(['peach'])
})

test('a lane run landing after a re-anchor leaves the new anchor uncovered', async () => {
  const pair = (i: number, mate: string, anchor: string) =>
    new SimpleFeature({
      uniqueId: `${anchor}-g${i}`,
      name: `g${i}`,
      refName: 'ctgA',
      start: 100 + 150 * i,
      end: 160 + 150 * i,
      strand: 1,
      assemblyName: anchor,
      mate: {
        assemblyName: mate,
        refName: 'ctgA',
        start: 100 + 150 * i,
        end: 160 + 150 * i,
        name: `g${i}`,
      },
    })
  let phase = 'first'
  const held: ((features: unknown[]) => void)[] = []
  const { display } = createDisplayWithSession({
    trackAssemblyNames: ['volvox', 'volvox_random'],
    geneTracks: [
      { trackId: 'volvox_genes', assemblyNames: ['volvox'] },
      { trackId: 'random_genes', assemblyNames: ['volvox_random'] },
    ],
    rpc: async (name, args) => {
      if (name === 'MultiWayGetFeatures') {
        return phase === 'first'
          ? [0, 1, 2, 3].map(i => pair(i, 'volvox_random', 'volvox'))
          : []
      }
      if (name !== 'CoreGetFeatures') {
        return []
      }
      const [region] = args.regions as { assemblyName: string }[]
      if (region!.assemblyName === 'volvox_random' && phase === 'first') {
        return new Promise(resolve => {
          held.push(resolve)
        })
      }
      return []
    },
  })
  await until(() => held.length > 0)
  phase = 'second'
  display.lgv.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox_random' },
  ])
  for (const resolve of held) {
    resolve([])
  }
  await when(() => display.laneGenes.landedFor !== undefined, {
    timeout: 5000,
  })
  expect(display.laneGenes.landedFor).toBe('volvox')

  display.setFeatures(
    [0, 1, 2, 3].map(i => pair(i, 'volvox', 'volvox_random')),
    'volvox_random',
  )
  await when(() => display.rowFrames.get('volvox') !== undefined, {
    timeout: 5000,
  })
  expect(display.awaitingDependentData).toBe(true)
})

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
    display.setLaneLinks(
      new Map([[spec!.lane, { key: spec!.key, links: [], ops: NO_OPS }]]),
      display.laneLinksFetchSpecs,
      display.anchorAssemblyName,
    )
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
    display.laneLinksFetchSpecs.map(s => [s.assemblyName, s.lowerAssembly]),
  ).toEqual([['volvox_random', 'volvox_ins']])
})

test('the track menu ends with the stacked-synteny launcher under Launch', () => {
  const display = createDisplay()
  const items = display.trackMenuItems()
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Show...',
    'Color by...',
    'Lanes',
    'Advanced',
    'Launch',
  ])
  const launch = items.at(-1)
  const subMenu = launch && 'subMenu' in launch ? resolveSubMenu(launch) : []
  expect(subMenu.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Linear synteny view (visible region)',
  ])
})

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
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  const entries = geneKeyOf(display)
  expect(entries.map(i => i.label)).toEqual(['atpA', 'atpB'])
  expect(new Set(entries.map(i => i.color)).size).toBe(2)
  expect(display.colorScales.map(s => s.id)).toEqual(['genes'])
  expect(display.hasLegendKey).toBe(true)
})

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
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(geneKeyOf(display)).toEqual([])
  expect(display.hasLegendKey).toBe(false)
})

function anchorGenes(display: MultiWaySyntenyDisplayModel, genes: LaneGene[]) {
  display.setLaneGenes(
    new Map([['volvox', { key: display.laneGenesFetchSpecs[0]!.key, genes }]]),
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
}

function anchorGeneFills(display: MultiWaySyntenyDisplayModel) {
  const cell = display.laneGlyphCells.get('glyphs:0')
  return cell?.kind === 'glyphs'
    ? cell.data.hits.map(h => [h.feature.id(), h.fill?.css])
    : []
}

test('a color string paints through the channel, and unset is goldenrod', () => {
  const display = createDisplay()
  anchorGenes(display, [namedGene('g1', 'atpA', 100, 300)])
  expect(anchorGeneFills(display)).toEqual([['g1', 'goldenrod']])

  setConf(display, 'color', "jexl:feature.name == 'atpA' ? 'red' : 'blue'")
  expect(display.geneColorField).toBe('')
  expect(anchorGeneFills(display)).toEqual([['g1', 'red']])
})

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

test('gene names the hash puts on one colour each take their own', () => {
  const display = createDisplay()
  anchorGenes(display, [
    namedGene('g1', 'protein_coding', 100, 300),
    namedGene('g2', 'snRNA', 400, 600),
    namedGene('g3', 'TEC', 700, 900),
  ])
  display.setGeneColorBy('name')
  const fills = anchorGeneFills(display).map(([, css]) => css)
  expect(fills).toHaveLength(3)
  expect(new Set(fills).size).toBe(3)
})

test('a ribbon colour pick keeps the ramp the config declares', () => {
  const display = createDisplay()
  setConf(display, 'ribbonColor', {
    field: 'identity',
    scheme: 'magma',
    reverse: true,
    domainMin: 90,
    domainMax: 100,
    domainMid: 95,
  })
  const ramp = {
    scheme: 'magma',
    reverse: true,
    domainMin: 90,
    domainMax: 100,
    domainMid: 95,
  }
  display.setRibbonColorField('identity')
  expect(display.ribbonRamp).toMatchObject(ramp)
  display.setRibbonColorField('')
  display.setRibbonColorField('identity')
  expect(display.ribbonRamp).toMatchObject(ramp)
})

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
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(display.colorScales.map(s => s.id)).toEqual(['genes'])

  display.setRibbonColorField('strand')
  expect(display.colorScales.map(s => s.id)).toEqual(['genes', 'ribbons'])
})

test('the drawing toggles write the slots the display reads back', () => {
  const display = createDisplay()
  expect(display.drawCurves).toBe(false)
  expect(display.showLaneTicks).toBe(true)

  display.setDrawCurves(true)
  display.setShowLaneTicks(false)
  expect(display.drawCurves).toBe(true)
  expect(display.showLaneTicks).toBe(false)
})

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
    expect(span[0]).toBeGreaterThan(span[1])
  })
})

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

  display.setHoverTarget(undefined)
  expect(display.clickedTarget?.linkId).toBe('f1')

  display.selectHovered()
  expect(display.clickedTarget).toBeUndefined()

  // the click's own widget resizes the view, and that refetches
  display.setHoverTarget({ label: 'g', feature, groupKey: 'g1' })
  display.selectHovered()
  display.setFeatures([])
  expect(display.clickedTarget).toEqual({ groupKey: 'g1', linkId: undefined })
})

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
    const pitch = MIN_LANE_PITCH + display.geneLabelPx
    expect(display.scrollContentHeight).toBe((MATES + 1) * pitch)
    expect(display.scrollableHeight).toBe((MATES + 1) * pitch - display.height)
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
  // keep the computed hot: outside a reaction each read re-evaluates it
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
  // keep the computeds hot: outside a reaction each read re-evaluates them
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
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(display.laneStack).toBe(stack)
  expect(display.ribbonGeometry).toBe(ribbons)
  expect(display.tickGeometry).toBe(ticks)
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
      }
    await until(() => calls.some(c => c.name === 'MultiWayGetFeatures'))
    expect(
      opts(calls.find(c => c.name === 'MultiWayGetFeatures')!).lodMode,
    ).toBe('coarse')
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
          c.name === 'MultiWayGetFeatures' &&
          opts(c).targetAssemblyName === 'volvox_ins',
      )
    await until(() => linkCall() !== undefined)
    expect(opts(linkCall()!).lodMode).toBe('coarse')
  })

  test('the ortholog fetch asks for the merged blocks', async () => {
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
    await until(() => calls.some(c => c.name === 'MultiWayGetFeatures'))
    const { args } = calls.find(c => c.name === 'MultiWayGetFeatures')!
    expect(args.opts).toEqual({ mateShape: 'grouped', lodMode: 'fine' })
    expect(args.regions).toEqual([
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ])
  })
})

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
  await when(() => display.laneGenes.held?.has('volvox_random') ?? false, {
    timeout: 5000,
  })
  expect(display.dataSuperseded).toBe(false)
  const anchorGenes = display.laneGenes.held!.get('volvox')
  const mateGenes = display.laneGenes.held!.get('volvox_random')
  const issued = geneCalls().length

  display.setLaneFrames(
    0,
    new Map([['volvox_random', decisionOn('ctgB', 100200)]]),
  )
  expect(display.dataSuperseded).toBe(true)
  await when(() => !display.dataSuperseded, { timeout: 5000 })
  const since = geneCalls().slice(issued)
  expect(since.map(laneOf)).toEqual(['volvox_random'])
  expect(display.laneGenes.held!.get('volvox')).toBe(anchorGenes)
  expect(display.laneGenes.held!.get('volvox_random')).not.toBe(mateGenes)
  expect(display.laneGenes.held!.get('volvox_random')!.key).toBe(
    display.laneGenesFetchSpecs[1]!.key,
  )
})

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
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
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

  // a lane's fills key on its gene commit, the boxes' on the ortholog commit
  display.setLaneGenes(
    new Map([['volvox', { key: 'later', genes: [] }]]),
    display.laneGenesFetchSpecs,
    display.anchorAssemblyName,
  )
  expect(display.laneGeneColors.get('volvox')).not.toBe(genes)
  display.setFeatures([mateRecord('own2', 'volvox_random', 'gene2')])
  expect(display.boxColors).not.toBe(boxes)
  stop()
})

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
    expect(display.pairLinks.has(pair)).toBe(false)

    display.setLaneLinks(
      new Map([
        [
          pair,
          {
            key: display.laneLinksFetchSpecs[0]!.key,
            links: [],
            ops: NO_OPS,
          },
        ],
      ]),
      display.laneLinksFetchSpecs,
      display.anchorAssemblyName,
    )
    const composed = display.pairLinks.get(pair)!.links
    expect(composed).toHaveLength(1)
    const [link] = composed
    // forward upper, reversed lower: the link runs crosswise over ctgA:200-300
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
    display.setLaneLinks(
      new Map([[pair, { key: 'k', links: [direct], ops: NO_OPS }]]),
      display.laneLinksFetchSpecs,
      display.anchorAssemblyName,
    )
    expect(display.pairLinks.get(pair)!.links).toEqual([direct])
  })

  const readOnAnchor = async (
    answer: SimpleFeature[],
    ops: ReadonlyMap<string, Uint32Array> = NO_OPS,
  ) => {
    const calls: { name: string; args: Record<string, unknown> }[] = []
    const opts = (call: { args: Record<string, unknown> }) =>
      (call.args.opts ?? {}) as Record<string, unknown>
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
      trackAssemblyNames: ['volvox', 'volvox_random', 'volvox_ins'],
      geneTracks: [],
      rpc: async (name, args) => {
        calls.push({ name, args })
        return name === 'CoreGetInfo'
          ? { hasCoarseTier: false, anchorAssemblyName: 'volvox', lanes: [] }
          : opts({ args }).queryAssemblyName === undefined
            ? []
            : { features: answer, ops }
      },
    })
    await when(
      () => display.starAnchor !== undefined && display.features !== undefined,
      { timeout: 5000 },
    )
    display.setFeatures(starRecords())
    display.setLaneFrames(0, frames)
    const pairCall = () =>
      calls.find(
        c =>
          c.name === 'MultiWayGetFeatures' &&
          opts(c).queryAssemblyName !== undefined,
      )
    return { display, pairCall, opts }
  }

  test('an adapter reading lane pairs on its anchor is asked for each pair in the anchor window', async () => {
    const { display, pairCall, opts } = await readOnAnchor([])
    const [spec] = display.laneLinksFetchSpecs
    expect(spec).toMatchObject({
      lane: pair,
      onAnchor: true,
      assemblyName: 'volvox_random',
      lowerAssembly: 'volvox_ins',
      regions: [
        { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
      ],
    })
    await until(() => pairCall() !== undefined)
    expect(pairCall()!.args.regions).toEqual(spec!.regions)
    expect(opts(pairCall()!)).toMatchObject({
      queryAssemblyName: 'volvox_random',
      targetAssemblyName: 'volvox_ins',
    })
  })

  test('an anchor-window pair draws the ops of the records the adapter answers', async () => {
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
        end: 1230,
      },
    })
    const { display } = await readOnAnchor(
      [direct],
      new Map([['direct', Uint32Array.from(parseCigar2('40=20D40='))]]),
    )
    expect(
      display.pairLinks.get(pair)!.links[0]!.get('composedThrough'),
    ).toBeDefined()
    await until(() => display.laneLinks.held?.has(pair) === true)
    expect(display.pairLinks.get(pair)!.links).toEqual([direct])
    expect([...ribbonsBetweenMates(display).kinds]).toEqual([
      KIND_BASE,
      KIND_BASE,
    ])
  })

  test('an anchor-window pair the adapter answers with nothing composes', async () => {
    const { display } = await readOnAnchor([])
    await until(() => display.laneLinks.held?.has(pair) === true)
    expect(display.laneLinks.held!.get(pair)!.links).toEqual([])
    expect(
      display.pairLinks.get(pair)!.links.map(l => l.get('composedThrough')),
    ).toEqual([{ refName: 'ctgA', start: 200, end: 300 }])
  })
})

describe('lane pairs on a graph source', () => {
  const lanes = Array.from({ length: 60 }, (_, i) => `sample${i}#1`)
  const graphDisplay = async (
    adapterType: string,
    answer: (opts: Record<string, unknown>) => unknown = () => [],
  ) => {
    const calls: Record<string, unknown>[] = []
    const { display } = createDisplayWithSession({
      syntenyAdapter: { type: adapterType },
      trackAssemblyNames: ['volvox'],
      geneTracks: [],
      rpc: async (name, args) => {
        const opts = (args.opts ?? {}) as Record<string, unknown>
        if (name === 'MultiWayGetFeatures') {
          calls.push(opts)
        }
        return name === 'CoreGetInfo'
          ? { hasCoarseTier: false, anchorAssemblyName: 'volvox', lanes: [] }
          : opts.queryAssemblyName === undefined && opts.lanePairs === undefined
            ? []
            : answer(opts)
      },
    })
    await when(
      () => display.starAnchor !== undefined && display.features !== undefined,
      { timeout: 5000 },
    )
    display.setFeatures(
      lanes.map(
        (lane, i) =>
          new SimpleFeature({
            uniqueId: `r${i}`,
            refName: 'ctgA',
            start: 100,
            end: 300,
            strand: 1,
            mate: { assemblyName: lane, refName: 'ctgB', start: 100, end: 300 },
          }),
      ),
    )
    display.setLaneFrames(
      0,
      new Map(lanes.map(lane => [lane, decisionOn('ctgB', 200)])),
    )
    return { display, calls }
  }

  test('only pairs within a screen of the scrolled window are asked for', async () => {
    const { display } = await graphDisplay('GbzBaseSyntenyAdapter')
    const pairs = () => display.laneLinksFetchSpecs.map(s => s.lane)
    const first = `${lanes[0]}|${lanes[1]}`
    const last = `${lanes[58]}|${lanes[59]}`
    expect(display.rowAssemblies).toHaveLength(60)
    expect(pairs()).toContain(first)
    expect(pairs()).not.toContain(last)
    expect(pairs().length).toBeLessThan(59)

    display.setScrollTop(1e9)
    expect(pairs()).toContain(last)
    expect(pairs()).not.toContain(first)
  })

  test('a pair scrolled out of range keeps what it fetched for the same window', async () => {
    const { display } = await graphDisplay('GbzBaseSyntenyAdapter')
    const [spec] = display.laneLinksFetchSpecs
    display.setLaneLinks(
      new Map([[spec!.lane, { key: spec!.key, links: [], ops: NO_OPS }]]),
      display.laneLinksFetchSpecs,
      display.anchorAssemblyName,
    )
    display.setScrollTop(1e9)
    display.setLaneLinks(new Map(), display.laneLinksFetchSpecs, 'volvox')
    expect(display.laneLinks.held?.has(spec!.lane)).toBe(true)

    display.setLaneLinks(
      new Map(),
      display.laneLinksFetchSpecs.map(s => ({ ...s, key: 'panned' })),
      'volvox',
    )
    expect(display.laneLinks.held?.has(spec!.lane)).toBe(false)
  })

  test('a batching adapter answers every pair in one call, each record on its own pair', async () => {
    const link = (upper: string, lower: string) =>
      new SimpleFeature({
        uniqueId: `${upper}|${lower}`,
        refName: 'ctgB',
        start: 150,
        end: 250,
        strand: 1,
        mate: { assemblyName: lower, refName: 'ctgB', start: 150, end: 250 },
        assemblyName: upper,
      })
    const { display, calls } = await graphDisplay(
      'BatchingGraphAdapter',
      opts => ({
        features: (
          opts.lanePairs as {
            queryAssemblyName: string
            targetAssemblyName: string
          }[]
        ).map(p => link(p.queryAssemblyName, p.targetAssemblyName)),
        ops: NO_OPS,
      }),
    )
    const specs = display.laneLinksFetchSpecs
    expect(specs.length).toBeGreaterThan(1)
    await until(() =>
      specs.every(s => display.laneLinks.held?.has(s.lane) === true),
    )
    const pairCalls = calls.filter(
      c => c.lanePairs !== undefined || c.queryAssemblyName !== undefined,
    )
    expect(pairCalls).toHaveLength(1)
    expect(pairCalls[0]!.lanePairs).toHaveLength(specs.length)
    for (const spec of specs) {
      expect(
        display.laneLinks.held!.get(spec.lane)!.links.map(l => l.id()),
      ).toEqual([spec.lane])
    }
  })
})

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
  // the fetch asked only for the track's lane, so the window says nothing of HG1#1
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

test('the header read and the fetch name the lanes a lane-declaring source reads', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = []
  const { display } = createDisplayWithSession({
    syntenyAdapter: { type: 'GbzBaseSyntenyAdapter' },
    trackAssemblyNames: ['volvox', 'HG00097.1', 'HG00099.1'],
    rpc: async (name, args) => {
      calls.push({ name, args })
      return name === 'CoreGetInfo' ? { hasCoarseTier: false } : []
    },
  })
  await until(() => calls.some(c => c.name === 'MultiWayGetFeatures'))
  await until(() => calls.some(c => c.name === 'CoreGetInfo'))
  const lanes = ['HG00097.1', 'HG00099.1']
  expect(calls.find(c => c.name === 'CoreGetInfo')!.args.haplotypes).toEqual(
    lanes,
  )
  const fetch = calls.find(c => c.name === 'MultiWayGetFeatures')!.args
  expect(fetch.haplotypes).toEqual(lanes)
  expect(fetch.opts).not.toHaveProperty('haplotypes')
  expect(display.fetchLaneSelection).toEqual(lanes)
})

test('a lane selection reaches the fetch only where the adapter can cut on it', () => {
  // MCScanBlocksAdapter declares no lane universe
  const plain = createDisplay()
  plain.setSelectedLanes(['sample#1#a'])
  expect(plain.laneSelection).toEqual(['sample#1#a'])
  expect(plain.fetchLaneSelection).toBeUndefined()
  expect(plain.rpcProps()).toEqual({ haplotypes: undefined })

  // the graph adapter declares its lanes in its header
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

test("ribbonColor's range paints the domain, and labels and title name its key", () => {
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
  const color = {
    field: 'group',
    domain: ['C1'],
    range: ['#ff0000'],
    labels: ['Core'],
    title: 'Gene family',
  }
  display.configuration.setSubschema('ribbonColor', color)
  display.setFeatures([row('f1', 'B1'), row('f2', 'C1')])
  const mode = resolveCategoricalMode('group', display.ribbonAttributeRanges)!
  expect(categoricalColor(mode, 'C1')).toBe('#ff0000')
  const ribbons = display.colorScales.find(scale => scale.id === 'ribbons')
  expect(ribbons?.title).toBe('Gene family')
  expect(
    ribbons?.kind === 'categorical' ? ribbons.entries.map(e => e.label) : [],
  ).toEqual(['Core', 'B1'])
  display.setRibbonColorField('group')
  expect(getSnapshot(display.configuration.ribbonColor)).toEqual(color)
})

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
  ).toThrow(
    'RibbonColor takes value, field, scale, domain, range, scheme, reverse, domainMid, domainMin, domainMax, labels and title, not palette',
  )
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
  const feature = overhang
  expect(display.visibleGroups.map(g => g.mates.get('volvox_random'))).toEqual([
    [{ refName: 'ctgB', start: 5000, end: 6000, orientation: 1, feature }],
  ])
  expect(display.fitGroups.map(g => g.mates.get('volvox_random'))).toEqual([
    [{ refName: 'ctgB', start: 5000, end: 5800, orientation: 1, feature }],
  ])
  expect(display.fitGroups.map(g => g.anchor)).toEqual([
    { refName: 'ctgA', start: 0, end: 800 },
  ])
})

test('a record running off the viewport aligns its lane on the part it shows', () => {
  const display = createDisplay()
  display.setFeatures([
    new SimpleFeature({
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
    }),
  ])
  const { anchorAbsX, lgv } = display
  expect(anchorAbsX.get('r1')?.x).toBe(400)
  const decision = decideLaneFrames({
    groups: display.fitGroups,
    openingsOf: display.laneOpenings,
    assemblyNames: ['volvox_random'],
    anchorX: new Map([...anchorAbsX].map(([key, { x }]) => [key, x])),
    anchorCoordOf: group => anchorAbsX.get(group.key)!.coord,
    pxOfAnchor: coord => lgv.bpToPx(coord)?.offsetPx,
    unitBp: display.visibleBpSpan,
    width: display.canvasWidth,
    previous: new Map(),
  }).get('volvox_random')!
  const frame = frameFromDecision(
    decision,
    lgv.bpToPx(decision.pivotAnchor)!.offsetPx,
    display.visibleBpSpan,
    display.canvasWidth,
  )
  expect(frame.min).toBeCloseTo(5000)
})

// ctgA:300-700 against a region ending at ctgA:500 draws the half over ctgA:300-500
describe('a record crossing a displayed region’s end', () => {
  test.each([
    ['forward', 1, [1300, 1500], undefined],
    ['reverse', -1, [1500, 1700], undefined],
    ['named', 1, [1300, 1500], 'gene1'],
  ])(
    'is cut on its lane where the anchor is cut, %s',
    (_, strand, shown, name) => {
      const display = createDisplay()
      display.lgv.setDisplayedRegions([
        { refName: 'ctgA', start: 0, end: 500, assemblyName: 'volvox' },
      ])
      display.setFeatures([
        new SimpleFeature({
          uniqueId: 'r1',
          name,
          refName: 'ctgA',
          start: 300,
          end: 700,
          strand,
          mate: {
            assemblyName: 'volvox_random',
            refName: 'ctgB',
            start: 1300,
            end: 1700,
          },
        }),
      ])
      display.setLaneFrames(
        0,
        new Map([['volvox_random', decisionOn('ctgB', 1200)]]),
      )
      const [anchor, lane] = display.laneStack.lanes
      const cell = display.ribbonGeometry.cells.get('ribbons:0')!
      if (cell.kind !== 'ribbons') {
        throw new Error('ribbons:0 is not a ribbon cell')
      }
      const { data } = cell
      expect(data.instanceCount).toBe(1)
      expect([data.bp1[0], data.bp2[0]]).toEqual(
        anchor!.spanOf('ctgA', 300, 500)!.map(Math.fround),
      )
      const [lo, hi] = lane!.spanOf('ctgB', shown[0]!, shown[1]!)!
      expect([data.bp4[0], data.bp3[0]]).toEqual(
        (strand === 1 ? [lo, hi] : [hi, lo]).map(Math.fround),
      )
    },
  )
})

test("a gene-table row the anchor lacks is read on each lane's own window and joins the lanes that carry it", async () => {
  const vioB = {
    refName: 'ctgB',
    start: 150,
    end: 250,
    strand: 1,
    name: 'vioB',
  }
  const laneCalls: string[] = []
  const { display } = createDisplayWithSession({
    trackAssemblyNames: ['volvox', 'volvox_random', 'volvox_ins'],
    rpc: async (name, args) => {
      const [region] = args.regions as { assemblyName: string }[]
      if (name !== 'MultiWayGetFeatures' || region?.assemblyName === 'volvox') {
        return []
      }
      laneCalls.push(region!.assemblyName)
      return region!.assemblyName === 'volvox_random'
        ? [
            new SimpleFeature({
              uniqueId: 'vioB-row',
              ...vioB,
              assemblyName: 'volvox_random',
              mates: [{ ...vioB, assemblyName: 'volvox_ins', orientation: 1 }],
            }),
          ]
        : []
    },
  })
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures([
    mateRecord('r1', 'volvox_random', 'g1'),
    mateRecord('r2', 'volvox_ins', 'g2'),
  ])
  display.setLaneFrames(
    0,
    new Map([
      ['volvox_random', decisionOn('ctgB', 200)],
      ['volvox_ins', decisionOn('ctgB', 200)],
    ]),
  )
  await until(() => display.anchorlessGroups.length === 1)
  expect(laneCalls.sort()).toEqual(['volvox_ins', 'volvox_random'])
  const { key } = display.anchorlessGroups[0]!
  const [anchor, upper, lower] = display.laneStack.lanes
  expect(anchor!.placements.has(key)).toBe(false)
  expect(upper!.placements.has(key)).toBe(true)
  expect(lower!.placements.has(key)).toBe(true)
  expect(
    display.ribbonGeometry.targets.find(t => t.groupKey === key)?.label,
  ).toBe('vioB\nnot in volvox')
})
