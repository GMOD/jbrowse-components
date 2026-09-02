import {
  findAssemblyConf,
  openSampleInNewView,
} from '../openSampleInNewView.ts'
import {
  sampleNavigationItems,
  selectedRowTargets,
} from './sampleNavigationItems.ts'

import type { SampleNavigationModel } from './sampleNavigationItems.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// 1px = 1bp starting at bp 100, single region, 10px rows with no scroll.
type Target = ReturnType<SampleNavigationModel['rowNavigationTargets']>[number]

function model(
  targets: Record<number, Omit<Target, 'rowIndex'>>,
): SampleNavigationModel {
  return {
    id: 'display1',
    view: {
      assemblyNames: ['hg38'],
      bpPerPx: 1,
      pxToBp: px => ({
        index: 0,
        offset: px,
        start: 100,
        end: 200,
        refName: 'chr1',
        coord: 100 + px,
        coord0: 100 + px,
        assemblyName: 'hg38',
        reversed: false,
        oob: false,
        refIndex: 0,
      }),
    },
    scrollTop: 0,
    rowsTopOffset: 0,
    effectiveRowHeight: 10,
    rowProportion: 1,
    rowHoverInfo: () => undefined,
    rowNavigationTargets: (_regionIndex, _startBp, _endBp, startRow, endRow) =>
      Object.entries(targets)
        .map(([row, t]) => ({ ...t, rowIndex: Number(row) }))
        .filter(t => t.rowIndex >= startRow && t.rowIndex < endRow),
  }
}

const views: { id: string; init?: unknown }[] = []
const session = {
  views,
  addView: (_type: string, snap: { id: string }) => {
    views.push(snap)
  },
} as unknown as AbstractSessionModel

const coord = {
  startX: 5,
  endX: 25,
  startY: 0,
  endY: 20,
  anchor: { clientX: 0, clientY: 0 },
}

function target(sampleLabel: string, start: number) {
  return {
    assemblyName: 'mm10',
    assemblyConfigLocation: undefined,
    chr: 'chr2',
    start,
    end: start + 20,
    sampleLabel,
  }
}

// the items are built from a row-target list, so a case names the selection it
// came from and reads it through the same function the menu does
function itemsFor(
  m: SampleNavigationModel,
  c: typeof coord = coord,
): ReturnType<typeof sampleNavigationItems> {
  return sampleNavigationItems(session, m, selectedRowTargets(m, c))
}

test('one entry per navigable row in the selection', () => {
  const items = itemsFor(
    model({ 0: target('SPRET_EiJ', 1000), 1: target('PWK_PhJ', 2000) }),
  )
  expect(items.map(i => ('label' in i ? i.label : undefined))).toEqual([
    'Open SPRET_EiJ chr2:1001-1020 in new view',
    'Open PWK_PhJ chr2:2001-2020 in new view',
  ])
})

test('rows with no navigation target contribute nothing', () => {
  expect(itemsFor(model({}))).toEqual([])
  expect(itemsFor(model({ 1: target('rn6', 5) }))).toHaveLength(1)
})

test('many navigable rows collapse into a submenu', () => {
  const targets = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [i, target(`s${i}`, i * 100)]),
  )
  const items = itemsFor(model(targets), { ...coord, endY: 80 })
  expect(items).toHaveLength(1)
  const [item] = items
  expect(item && 'subMenu' in item && item.subMenu).toHaveLength(8)
})

// Two 100bp regions abutting at px 15, 1px = 1bp. A drag (or the track menu's
// whole-window span) that starts in the first and ends in the second reads its
// right edge in the second region's coordinates.
function twoRegionModel(): SampleNavigationModel {
  return {
    ...model({ 0: target('SPRET_EiJ', 1000) }),
    view: {
      assemblyNames: ['hg38'],
      bpPerPx: 1,
      pxToBp: px =>
        px < 15
          ? {
              index: 0,
              offset: px,
              start: 100,
              end: 115,
              refName: 'chr1',
              coord: 100 + px,
              coord0: 100 + px,
              assemblyName: 'hg38',
              reversed: false,
              oob: false,
              refIndex: 0,
            }
          : {
              index: 1,
              offset: px - 15,
              start: 5000,
              end: 5100,
              refName: 'chr2',
              coord: 5000 + px - 15,
              coord0: 5000 + px - 15,
              assemblyName: 'hg38',
              reversed: false,
              oob: false,
              refIndex: 1,
            },
    },
  }
}

test('a span crossing a region boundary clips to the region it began in', () => {
  const { refName, startBp, endBp } = selectedRowTargets(
    twoRegionModel(),
    coord,
  )
  expect({ refName, startBp, endBp }).toEqual({
    refName: 'chr1',
    startBp: 105,
    // the first region's last base, not px 25 read as chr2:5010
    endBp: 115,
  })
})

test('launching opens a view keyed on display + assembly', async () => {
  views.length = 0
  await openSampleInNewView(session, 'display1', target('SPRET_EiJ', 1000))
  expect(views).toEqual([
    {
      id: 'display1_mm10',
      assembly: 'mm10',
      loc: 'chr2:1001-1020',
    },
  ])
})

// get() reports an unknown name to Core-handleUnrecognizedAssembly, so using it
// as the "do we have this already?" probe made every navigation kick off a
// plugin's assembly-resolution guess (on genomes.jbrowse.org, a connection to a
// config that 404s) even when the answer was yes.
test('the have-we-got-it probe does not go through get()', async () => {
  views.length = 0
  const calls: string[] = []
  const loadedSession = {
    views,
    addView: (_type: string, snap: { id: string }) => {
      views.push(snap)
    },
    assemblyManager: {
      has: (name: string) => {
        calls.push(`has:${name}`)
        return true
      },
      get: (name: string) => {
        calls.push(`get:${name}`)
        return undefined
      },
    },
  } as unknown as AbstractSessionModel
  await openSampleInNewView(loadedSession, 'display1', {
    ...target('SPRET_EiJ', 1000),
    assemblyConfigLocation: {
      uri: 'https://example.com/mm10/config.json',
      locationType: 'UriLocation' as const,
    },
  })
  expect(calls).toEqual(['has:mm10'])
  expect(views).toHaveLength(1)
})

test('findAssemblyConf picks the named assembly out of a fetched config', () => {
  const configJson = {
    assemblies: [{ name: 'rn6' }, { name: 'SPRET_EiJ', sequence: {} }],
  }
  expect(findAssemblyConf(configJson, 'SPRET_EiJ')).toEqual({
    name: 'SPRET_EiJ',
    sequence: {},
  })
  expect(findAssemblyConf(configJson, 'nonexistent')).toBeUndefined()
  expect(findAssemblyConf({}, 'rn6')).toBeUndefined()
})
