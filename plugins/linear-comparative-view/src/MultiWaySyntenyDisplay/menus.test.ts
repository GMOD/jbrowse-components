import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { laneRegion } from './laneHeader.ts'
import {
  geneColorMenuItems,
  laneHeaderMenuItems,
  lanesMenuItem,
  multiWayTrackMenuItems,
  ribbonColorMenuItems,
  showSubMenuItems,
} from './menus.ts'

import type { LaneFilter } from './laneSelection.ts'
import type { HeaderLane } from './menus.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function labelsOf(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : '—'))
}

function subMenuOf(item: MenuItem | undefined) {
  return item && 'subMenu' in item ? resolveSubMenu(item) : []
}

const click = (item: MenuItem | undefined) => {
  ;(item as { onClick: () => void }).onClick()
}
const disabledOf = (items: MenuItem[]) =>
  items.map(item =>
    'label' in item ? !!(item as { disabled?: boolean }).disabled : undefined,
  )

const peach = {
  assemblyName: 'peach',
  label: 'peach',
  isAnchor: false,
  frame: {
    refName: 'pp1',
    min: 99.6,
    max: 2000.2,
    flipped: false,
    fitMin: 100,
    fitMax: 2000,
    alsoOn: [],
    alsoOnMore: 0,
  },
  canon: (ref: string) => ref.replace('pp', 'Pp'),
}

const grape: HeaderLane = {
  assemblyName: 'grape',
  label: 'grape',
  isAnchor: true,
  frame: undefined,
  canon: ref => ref,
}

function headerModel({
  held = true,
  pinned,
  flipPinned,
  canReanchor = true,
}: {
  held?: boolean
  pinned?: string
  flipPinned?: string
  canReanchor?: boolean
} = {}) {
  const calls: string[] = []
  const model = {
    rowAssemblies: ['peach', 'cacao'],
    domain: [] as string[],
    setDomain: (domain: string[]) => {
      calls.push(`order ${domain.join(',')}`)
    },
    hideLane: (name: string) => {
      calls.push(`hide ${name}`)
    },
    anchorLocString: 'chr1:1-1,000',
    holdsAssembly: () => held,
    canReanchor,
    pinnedLaneContigs: new Map(
      pinned === undefined ? [] : [['peach', pinned] as const],
    ),
    openInNewView: (name: string, loc: string) => {
      calls.push(`open ${name} ${loc}`)
    },
    reanchor: (name: string, loc: string) => {
      calls.push(`reanchor ${name} ${loc}`)
    },
    pinLaneContig: (name: string, refName: string | undefined) => {
      calls.push(`pin ${name} ${refName}`)
    },
    pinnedLaneFlips: new Map(
      flipPinned === undefined
        ? []
        : [['peach', { refName: flipPinned, flipped: true }] as const],
    ),
    flipLane: (name: string) => {
      calls.push(`flip ${name}`)
    },
    unpinLaneFlip: (name: string) => {
      calls.push(`unflip ${name}`)
    },
  }
  return { model, calls }
}

function trackModel({
  universe = 3,
  laneFilter,
  configuredLanes = [],
  domain = [],
  hasLegendKey = false,
  geneColorField = '',
  geneColorScale = geneColorField ? 'categorical' : 'none',
}: {
  universe?: number
  laneFilter?: LaneFilter
  configuredLanes?: string[]
  domain?: string[]
  hasLegendKey?: boolean
  geneColorField?: string
  geneColorScale?: string
} = {}) {
  const { model: header, calls } = headerModel()
  const model = {
    ...header,
    domain,
    laneStack: { lanes: [grape, peach] },
    laneUniverse: Array.from({ length: universe }, (_, i) => ({
      name: `lane${i}`,
      placed: true,
      drawn: true,
    })),
    laneFilter,
    configuredLanes,
    hiddenLanes: laneFilter?.except ?? [],
    showHiddenLanes: () => {
      calls.push('show hidden')
    },
    chooseLanes: () => {},
    setSelectedLanes: (names: string[] | undefined) => {
      calls.push(`select ${names === undefined ? 'reset' : names.join(',')}`)
    },
    openLaneSelection: () => {
      calls.push('open picker')
    },
    ribbonColorField: '',
    setRibbonColorBy: () => {},
    ribbonColorAttributes: [],
    ribbonAttributeRanges: {},
    ribbonColorDomain: [],
    setRibbonColorDomain: () => {},
    hideUnlabelled: false,
    setHideUnlabelled: () => {},
    showLaneTicks: true,
    setShowLaneTicks: () => {},
    splitStrands: false,
    setSplitStrands: () => {},
    drawCurves: false,
    setDrawCurves: () => {},
    bridgeSkippedLanes: true,
    setBridgeSkippedLanes: () => {},
    showLegend: true,
    setShowLegend: () => {},
    hasLegendKey,
    geneColorField,
    geneColorScale,
    setGeneColorBy: (field: string) => {
      calls.push(`gene color ${field}`)
    },
    geneColorDomain: [],
    pinnedGeneColorDomain: ['psbA'],
    pinGeneColorDomain: () => {
      calls.push('pin gene colors')
    },
  }
  return { model, calls }
}

test('the track menu is Show, Color by and Lanes', () => {
  const { model } = trackModel()
  expect(labelsOf(multiWayTrackMenuItems(model))).toEqual([
    'Show...',
    'Color by...',
    'Lanes',
  ])
  expect(labelsOf(showSubMenuItems(model))).toEqual([
    'Show lane ticks',
    'Split strands',
    'Curved lines',
    'Show ribbons across gaps',
  ])
})

test('Color by offers the synteny view modes a lane stack paints', () => {
  const { model } = trackModel()
  expect(labelsOf(ribbonColorMenuItems(model))).toEqual([
    'Default',
    'Strand',
    'Color by value',
  ])
})

// One menu, the genes' channel over the ribbons', each under its own heading
test('Color by heads the gene modes and the ribbon modes', () => {
  const { model, calls } = trackModel()
  const colorBy = subMenuOf(multiWayTrackMenuItems(model)[1])
  expect(labelsOf(colorBy)).toEqual([
    'Genes',
    'Default',
    'Cluster',
    'Name',
    'Strand',
    'Ribbons',
    'Default',
    'Strand',
    'Color by value',
  ])
  expect(colorBy.map(i => i.type)).toEqual([
    'subHeader',
    'radio',
    'radio',
    'radio',
    'radio',
    'subHeader',
    'radio',
    'radio',
    undefined,
  ])
  click(colorBy[2])
  expect(calls).toEqual(['gene color cluster'])
})

// A field the config names that no row writes is still the checked one, and a
// painting field offers its pin
test('the gene modes name a configured field and offer the pin under it', () => {
  const { model, calls } = trackModel({ geneColorField: 'biotype' })
  const genes = geneColorMenuItems(model)
  expect(labelsOf(genes)).toEqual([
    'Default',
    'Cluster',
    'Name',
    'Strand',
    'biotype',
    'Pin distinct colors',
  ])
  expect(genes.map(i => 'checked' in i && i.checked)).toEqual([
    false,
    false,
    false,
    false,
    true,
    false,
  ])
  click(genes[5])
  expect(calls).toEqual(['pin gene colors'])
  expect(labelsOf(geneColorMenuItems(trackModel().model))).not.toContain(
    'Pin distinct colors',
  )
})

// The pin writes values into `domain`, which under a threshold is the cuts
test('a threshold gene color offers no pin', () => {
  const { model } = trackModel({
    geneColorField: 'score',
    geneColorScale: 'threshold',
  })
  expect(labelsOf(geneColorMenuItems(model))).not.toContain(
    'Pin distinct colors',
  )
})

test('Show offers the legend only when something is keyed, and the hidden lanes once there are some', () => {
  const { model, calls } = trackModel({
    hasLegendKey: true,
    laneFilter: { except: ['peach', 'cacao'] },
  })
  const show = showSubMenuItems(model)
  expect(labelsOf(show).slice(4)).toEqual([
    'Show legend',
    'Show 2 hidden lanes',
  ])
  click(show[5])
  expect(calls).toEqual(['show hidden'])
})

test('Lanes lists each lane under its own header menu', () => {
  const { model } = trackModel()
  const lanes = lanesMenuItem(model).subMenu
  expect(labelsOf(lanes)).toEqual([
    'Choose lanes...',
    'Reset lane order',
    'Lane menus',
    'grape',
    'peach',
  ])
  expect(disabledOf(lanes)[1]).toBe(true)
  expect(labelsOf(subMenuOf(lanes[3]))).toEqual(
    labelsOf(laneHeaderMenuItems(model, grape)),
  )
  expect(labelsOf(subMenuOf(lanes[4]))).toEqual(
    labelsOf(laneHeaderMenuItems(model, peach)),
  )
})

test('the picker is offered once there are lanes to choose among, and a choice offers its undo', () => {
  const lanesOf = (opts: Parameters<typeof trackModel>[0]) => {
    const { model, calls } = trackModel(opts)
    return { lanes: lanesMenuItem(model).subMenu, calls }
  }
  expect(labelsOf(lanesOf({ universe: 1 }).lanes)[0]).toBe('Reset lane order')

  const { lanes, calls } = lanesOf({ laneFilter: { only: ['lane0'] } })
  expect(labelsOf(lanes).slice(0, 2)).toEqual([
    'Choose lanes...',
    'Show every lane (3)',
  ])
  click(lanes[0])
  click(lanes[1])
  expect(calls).toEqual(['open picker', 'select reset'])

  expect(
    labelsOf(
      lanesOf({ laneFilter: { only: ['lane2'] }, configuredLanes: ['lane1'] })
        .lanes,
    )[1],
  ).toBe("Show the track's lanes (1)")
  expect(
    labelsOf(lanesOf({ laneFilter: { except: ['lane2'] } }).lanes)[1],
  ).toBe('Reset lane order')
})

test('a lane moves and hides through the display', () => {
  const { model, calls } = headerModel()
  const row = laneHeaderMenuItems(model, { ...peach, assemblyName: 'cacao' })
  expect(labelsOf(row.slice(0, 3))).toEqual([
    'Move up',
    'Move down',
    'Hide lane',
  ])
  expect(disabledOf(row.slice(0, 3))).toEqual([false, true, false])
  click(row[0])
  click(row[2])
  expect(calls).toEqual(['order cacao,peach', 'hide cacao'])
})

test('the last lane drawn cannot be hidden', () => {
  const { model } = headerModel()
  expect(
    disabledOf(
      laneHeaderMenuItems({ ...model, rowAssemblies: ['peach'] }, peach).slice(
        0,
        3,
      ),
    ),
  ).toEqual([true, true, true])
})

// The frame shows the contig explaining most of the window, and a genome with
// two homoeologous copies of it shows one: the other is named and offered, and
// a pin is undone from the same menu.
test('a lane names its other contigs and offers each, and a pin offers its release', () => {
  const twoCopies = {
    ...peach,
    frame: { ...peach.frame, alsoOn: ['pp5', 'pp7'] },
  }
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, twoCopies)
  expect(labelsOf(items).slice(5)).toEqual([
    'Show Pp5 in this lane',
    'Show Pp7 in this lane',
    'Flip lane',
  ])
  click(items[5])
  expect(calls).toEqual(['pin peach pp5'])

  const pinnedModel = headerModel({ pinned: 'pp5' })
  const pinnedItems = laneHeaderMenuItems(pinnedModel.model, {
    ...twoCopies,
    frame: { ...twoCopies.frame, refName: 'pp5', alsoOn: ['pp1'] },
  })
  expect(labelsOf(pinnedItems).slice(5)).toEqual([
    'Show Pp1 in this lane',
    'Let the lane choose its contig (pinned to Pp5)',
    'Flip lane',
  ])
  click(pinnedItems[6])
  expect(pinnedModel.calls).toEqual(['pin peach undefined'])
})

test("a mate lane's frame becomes a locstring in the lane assembly's own names", () => {
  expect(laneRegion(peach)).toEqual({ refName: 'Pp1', start: 100, end: 2000 })
  expect(laneRegion({ ...peach, frame: undefined })).toBeUndefined()
  expect(
    laneRegion({ ...peach, frame: { ...peach.frame, min: -40, max: 0.2 } }),
  ).toEqual({ refName: 'Pp1', start: 0, end: 1 })
})

test('a mate lane header opens its assembly elsewhere or re-anchors the track on it', () => {
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, peach)
  expect(labelsOf(items)).toEqual([
    'Move up',
    'Move down',
    'Hide lane',
    'Open peach at the matching region',
    'Re-anchor on peach',
    'Flip lane',
  ])
  click(items[3])
  click(items[4])
  expect(calls).toEqual([
    'open peach Pp1:101..2000',
    'reanchor peach Pp1:101..2000',
  ])
})

test('a lane drawn [rev] opens and re-anchors its assembly reversed', () => {
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, {
    ...peach,
    frame: { ...peach.frame, flipped: true },
  })
  for (const label of [
    'Open peach at the matching region',
    'Re-anchor on peach',
  ]) {
    click(items.find(item => 'label' in item && item.label === label))
  }
  expect(calls).toEqual([
    'open peach Pp1:101..2000[rev]',
    'reanchor peach Pp1:101..2000[rev]',
  ])
})

// A star aligns every lane to its one anchor, so a mate made the anchor
// places next to nothing: the row is left out rather than offered dead
test('a source aligned to one anchor offers no re-anchor', () => {
  expect(
    labelsOf(
      laneHeaderMenuItems(headerModel({ canReanchor: false }).model, peach),
    ),
  ).toEqual([
    'Move up',
    'Move down',
    'Hide lane',
    'Open peach at the matching region',
    'Flip lane',
  ])
})

// A lane in a window whose blocks split about evenly reads the way its vote
// fell; the reader turns it round, and hands the choice back from the same menu
test('a lane flips from its menu, and a flip pin offers its release', () => {
  const { model, calls } = headerModel()
  click(laneHeaderMenuItems(model, peach)[5])
  expect(calls).toEqual(['flip peach'])
  expect(
    labelsOf(laneHeaderMenuItems(model, { ...peach, frame: undefined })),
  ).not.toContain('Flip lane')

  const pinned = headerModel({ flipPinned: 'pp1' })
  const items = laneHeaderMenuItems(pinned.model, peach)
  expect(labelsOf(items).slice(5)).toEqual([
    'Flip lane',
    'Let the lane choose its orientation (pinned on Pp1)',
  ])
  click(items[6])
  expect(pinned.calls).toEqual(['unflip peach'])
})

test('the two hops are dead without a frame, and without the genome in the session', () => {
  const hops = (items: MenuItem[]) => disabledOf(items).slice(3, 5)
  expect(hops(laneHeaderMenuItems(headerModel().model, peach))).toEqual([
    false,
    false,
  ])
  expect(
    hops(
      laneHeaderMenuItems(headerModel().model, { ...peach, frame: undefined }),
    ),
  ).toEqual([true, true])
  expect(
    hops(laneHeaderMenuItems(headerModel({ held: false }).model, peach)),
  ).toEqual([true, true])
})

test('the anchor lane header only opens the view region elsewhere', () => {
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, grape)
  expect(labelsOf(items)).toEqual(['Open grape in a new view'])
  click(items[0])
  expect(calls).toEqual(['open grape chr1:1-1,000'])
})
