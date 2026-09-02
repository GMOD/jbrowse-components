import { mafLaunchMenuItems } from './launchMenuItems.ts'

import type { MafLaunchModel } from './launchMenuItems.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// 1px = 1bp starting at bp 100, one region, three rows, an 80px window
const WIDTH = 80

const widgets: Record<string, unknown>[] = []
const session = {
  rpcManager: {},
  configuration: {},
  widgets: new Map(),
  addWidget: (_type: string, _id: string, args: Record<string, unknown>) => {
    widgets.push(args)
    return args
  },
  showWidget: () => {},
  notifyError: () => {},
}

function target(sampleLabel: string) {
  return {
    assemblyName: 'mm10',
    chr: 'chr2',
    start: 1000,
    end: 1020,
    sampleLabel,
  }
}

function model(asked: [number, number, number][] = []) {
  return {
    id: 'display1',
    samples: [{ id: 's0' }, { id: 's1' }, { id: 's2' }],
    sources: [{ name: 's0' }, { name: 's1' }, { name: 's2' }],
    adapterConfig: { type: 'MafTabixAdapter' },
    scrollTop: 0,
    rowsTopOffset: 0,
    effectiveRowHeight: 10,
    rowProportion: 1,
    rowHoverInfo: () => undefined,
    rpcDataMap: { get: () => undefined },
    view: {
      id: 'view1',
      width: WIDTH,
      assemblyNames: ['hg38'],
      bpPerPx: 1,
      tracks: [],
      pxToBp: (px: number) => ({
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
    rowNavigationTarget: (
      regionIndex: number,
      startBp: number,
      endBp: number,
      rowIndex: number,
    ) => {
      asked.push([startBp, endBp, rowIndex])
      return rowIndex === 0 ? undefined : target(`s${rowIndex}`)
    },
  } as unknown as MafLaunchModel
}

function launchSubMenu(m: MafLaunchModel) {
  const [entry] = mafLaunchMenuItems({
    session: session as never,
    model: m,
    view: m.view as unknown as LinearGenomeViewModel,
  })
  expect(entry && 'label' in entry ? entry.label : undefined).toBe('Launch')
  return entry && 'subMenu' in entry ? entry.subMenu : []
}

function labels(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : undefined))
}

test('the drag menu’s three offers reach the track menu', () => {
  expect(labels(launchSubMenu(model()))).toEqual([
    'View subsequences (visible region)',
    'Open s1 chr2:1001-1020 in new view',
    'Open s2 chr2:1001-1020 in new view',
    'Launch synteny view, hg38 vs...',
  ])
})

test('it asks about the whole window and every row, not a selection', () => {
  const asked: [number, number, number][] = []
  launchSubMenu(model(asked))
  expect(asked).toEqual([
    [100, 180, 0],
    [100, 180, 1],
    [100, 180, 2],
  ])
})

test('the subsequence entry opens the widget over that same window', () => {
  widgets.length = 0
  const items = launchSubMenu(model())
  const [subsequences] = items
  if (!subsequences || !('onClick' in subsequences)) {
    throw new Error('no subsequence entry')
  }
  subsequences.onClick()
  expect(widgets[0]!.regions).toEqual([
    { refName: 'chr1', start: 100, end: 180, assemblyName: 'hg38' },
  ])
  expect(widgets[0]!.samples).toHaveLength(3)
})
