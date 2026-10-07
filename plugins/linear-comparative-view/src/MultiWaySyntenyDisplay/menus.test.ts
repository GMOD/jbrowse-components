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
  hasAnnotation: true,
}

const grape: HeaderLane = {
  assemblyName: 'grape',
  label: 'grape',
  isAnchor: true,
  frame: undefined,
  canon: ref => ref,
  hasAnnotation: true,
}

function headerModel({
  held = true,
  pinned,
  flipPinned,
  canReanchor = true,
  lanesFrozen = false,
}: {
  held?: boolean
  pinned?: string
  flipPinned?: string
  canReanchor?: boolean
  lanesFrozen?: boolean
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
    lanesFrozen,
    realignLane: (name: string) => {
      calls.push(`realign ${name}`)
    },
  }
  return { model, calls }
}

function trackModel({
  universe = 3,
  laneChoice,
  hiddenLanes = [],
  configuredLanes = [],
  domain = [],
  hasLegendKey = false,
  geneColorField = '',
  geneSolidColor,
}: {
  universe?: number
  laneChoice?: readonly string[]
  hiddenLanes?: readonly string[]
  configuredLanes?: string[]
  domain?: string[]
  hasLegendKey?: boolean
  geneColorField?: string
  geneSolidColor?: string
} = {}) {
  const { model: header, calls } = headerModel()
  const model = {
    ...header,
    domain,
    laneStack: { lanes: [grape, peach] },
    laneStructureOrder: [],
    laneUniverse: Array.from({ length: universe }, (_, i) => ({
      name: `lane${i}`,
      placed: true,
      drawn: true,
    })),
    laneChoice,
    configuredLanes,
    hiddenLanes,
    showHiddenLanes: () => {
      calls.push('show hidden')
    },
    chooseLanes: () => {},
    setSelectedLanes: (names: readonly string[] | undefined) => {
      calls.push(`select ${names === undefined ? 'reset' : names.join(',')}`)
    },
    openLaneSelection: () => {
      calls.push('open picker')
    },
    ribbonColorField: '',
    setRibbonColorField: () => {},
    ribbonColorAttributes: [],
    ribbonAttributeRanges: {},
    hideUnlabelled: false,
    setHideUnlabelled: () => {},
    showLaneTicks: true,
    setShowLaneTicks: () => {},
    splitStrands: false,
    showGeneLabels: true,
    setShowGeneLabels: () => {},
    inlineLaneNames: false,
    setInlineLaneNames: () => {},
    setSplitStrands: () => {},
    drawCurves: false,
    setDrawCurves: () => {},
    bridgeSkippedLanes: true,
    rowsVsAnchor: false,
    setBridgeSkippedLanes: () => {},
    showLegend: true,
    setShowLegend: () => {},
    hasLegendKey,
    geneColorField,
    setGeneColorBy: (field: string) => {
      calls.push(`gene color ${field}`)
    },
    geneSolidColor,
    pickDefaultGeneColor: () => {
      calls.push('gene default')
    },
    pickGeneSolidColor: () => {
      calls.push('gene solid')
    },
    setLanesFrozen: (flag: boolean) => {
      calls.push(`freeze ${flag}`)
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
    'Show gene labels',
    'Lane names on the gene row',
    'Split strands',
    'Curved lines',
    'Show ribbons across gaps',
  ])
})

test('a source reading each lane against its anchor offers no bridging', () => {
  const { model } = trackModel()
  expect(
    labelsOf(showSubMenuItems({ ...model, rowsVsAnchor: true })),
  ).not.toContain('Show ribbons across gaps')
})

test('Color by offers the synteny view modes a lane stack paints', () => {
  const { model } = trackModel()
  expect(labelsOf(ribbonColorMenuItems(model))).toEqual([
    'Default',
    'Strand',
    'Color by value',
  ])
})

test('Color by heads the gene modes and the ribbon modes', () => {
  const { model, calls } = trackModel()
  const colorBy = subMenuOf(multiWayTrackMenuItems(model)[1])
  expect(labelsOf(colorBy)).toEqual([
    'Genes',
    'Default',
    'Cluster',
    'Name',
    'Strand',
    'Solid color...',
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
    'radio',
    'subHeader',
    'radio',
    'radio',
    undefined,
  ])
  click(colorBy[2])
  expect(calls).toEqual(['gene color cluster'])
})

// The Genes block of Color by..., between its header and the Ribbons one
function genesOf(model: Parameters<typeof multiWayTrackMenuItems>[0]) {
  const colorBy = subMenuOf(multiWayTrackMenuItems(model)[1])
  return colorBy.slice(1, labelsOf(colorBy).indexOf('Ribbons'))
}

test('the gene modes name a configured field, with no pin under it', () => {
  const { model } = trackModel({ geneColorField: 'biotype' })
  const genes = genesOf(model)
  expect(labelsOf(genes)).toEqual([
    'Default',
    'Cluster',
    'Name',
    'Strand',
    'biotype',
    'Solid color...',
  ])
  expect(labelsOf(geneColorMenuItems(model))).toEqual(labelsOf(genes))
  expect(genes.map(i => 'checked' in i && i.checked)).toEqual([
    false,
    false,
    false,
    false,
    true,
    false,
  ])
})

test('a constant gene colour ticks Solid color..., and Default takes it back', () => {
  const { model, calls } = trackModel({ geneSolidColor: 'teal' })
  const genes = genesOf(model)
  const checked = (label: string) => {
    const item = genes[labelsOf(genes).indexOf(label)]
    return item && 'checked' in item && item.checked
  }
  expect(checked('Solid color...')).toBe(true)
  expect(checked('Default')).toBe(false)
  click(genes[0])
  click(genes.at(-1))
  expect(calls).toEqual(['gene default', 'gene solid'])
})

test('Show offers the legend only when something is keyed, and the hidden lanes once there are some', () => {
  const { model, calls } = trackModel({
    hasLegendKey: true,
    hiddenLanes: ['peach', 'cacao'],
  })
  const show = showSubMenuItems(model)
  expect(labelsOf(show).slice(6)).toEqual([
    'Show legend',
    'Show 2 hidden lanes',
  ])
  click(show[7])
  expect(calls).toEqual(['show hidden'])
})

test('an alignment stack offers its structure order, which writes the domain', () => {
  const { model } = trackModel()
  const order = ['c', 'a', 'b']
  const domains: string[][] = []
  const lanes = lanesMenuItem({
    ...model,
    laneStructureOrder: order,
    setDomain: (domain: string[]) => {
      domains.push(domain)
    },
  }).subMenu
  const item = lanes.find(
    i => 'label' in i && i.label === 'Order lanes by structure',
  )
  expect(item).toBeDefined()
  ;(item as { onClick: () => void }).onClick()
  expect(domains).toEqual([order])
})

test('Lanes lists each lane under its own header menu', () => {
  const { model } = trackModel()
  const lanes = lanesMenuItem(model).subMenu
  expect(labelsOf(lanes)).toEqual([
    'Choose lanes...',
    'Reset lane order',
    'Freeze lanes',
    'Lane menus',
    'grape',
    'peach',
  ])
  expect(disabledOf(lanes)[1]).toBe(true)
  expect(labelsOf(subMenuOf(lanes[4]))).toEqual(
    labelsOf(laneHeaderMenuItems(model, grape)),
  )
  expect(labelsOf(subMenuOf(lanes[5]))).toEqual(
    labelsOf(laneHeaderMenuItems(model, peach)),
  )
})

test('Freeze lanes toggles, and a frozen lane offers Re-align lane', () => {
  const { model, calls } = trackModel()
  const freeze = lanesMenuItem(model).subMenu.find(
    item => 'label' in item && item.label === 'Freeze lanes',
  )
  click(freeze)
  expect(calls).toEqual(['freeze true'])
  expect(labelsOf(laneHeaderMenuItems(model, peach))).not.toContain(
    'Re-align lane',
  )
  const frozen = headerModel({ lanesFrozen: true })
  const items = laneHeaderMenuItems(frozen.model, peach)
  click(items.find(item => 'label' in item && item.label === 'Re-align lane'))
  expect(frozen.calls).toEqual(['realign peach'])
})

test('the picker is offered once there are lanes to choose among, and a choice offers its undo', () => {
  const lanesOf = (opts: Parameters<typeof trackModel>[0]) => {
    const { model, calls } = trackModel(opts)
    return { lanes: lanesMenuItem(model).subMenu, calls }
  }
  expect(labelsOf(lanesOf({ universe: 1 }).lanes)[0]).toBe('Reset lane order')

  const { lanes, calls } = lanesOf({ laneChoice: ['lane0'] })
  expect(labelsOf(lanes).slice(0, 2)).toEqual([
    'Choose lanes...',
    'Show every lane (3)',
  ])
  click(lanes[0])
  click(lanes[1])
  expect(calls).toEqual(['open picker', 'select reset'])

  expect(
    labelsOf(
      lanesOf({ laneChoice: ['lane2'], configuredLanes: ['lane1'] }).lanes,
    )[1],
  ).toBe("Show the track's lanes (1)")
  expect(labelsOf(lanesOf({ hiddenLanes: ['lane2'] }).lanes)[1]).toBe(
    'Reset lane order',
  )
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

test('a lane with no gene track says so once, as a dead menu line', () => {
  const { model } = headerModel()
  const items = laneHeaderMenuItems(model, { ...peach, hasAnnotation: false })
  expect(labelsOf(items).at(-1)).toBe('No gene track for this genome')
  expect(disabledOf(items).at(-1)).toBe(true)
  expect(labelsOf(laneHeaderMenuItems(model, peach))).not.toContain(
    'No gene track for this genome',
  )
})

test('the anchor lane header only opens the view region elsewhere', () => {
  const { model, calls } = headerModel()
  const items = laneHeaderMenuItems(model, grape)
  expect(labelsOf(items)).toEqual(['Open grape in a new view'])
  click(items[0])
  expect(calls).toEqual(['open grape chr1:1-1,000'])
})
