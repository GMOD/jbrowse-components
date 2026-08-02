import { ConfigurationSchema } from '@jbrowse/core/configuration'

import {
  syntenyRegionMenuItems,
  toWholeBpRegion,
  widestRegion,
} from './regionLaunchMenuItems.ts'

import type { AbstractSessionModel, Region } from '@jbrowse/core/util'

// Real config models rather than stubs with a mocked readConfObject: the
// discovery reads `type`, `trackId` and `assemblyNames` off them, which is
// exactly what a fake would have to reimplement.
const schema = ConfigurationSchema(
  'SyntenyTrack',
  {
    name: { type: 'string', defaultValue: '' },
    assemblyNames: { type: 'stringArray', defaultValue: [] },
  },
  { explicitIdentifier: 'trackId', explicitlyTyped: true },
)

function track(trackId: string, assemblyNames: string[]) {
  return schema.create({ trackId, name: trackId, assemblyNames })
}

function makeSession(tracks: ReturnType<typeof track>[]) {
  const queued: unknown[][] = []
  return {
    session: {
      tracks,
      assemblies: [],
      queueDialog: (cb: (close: () => void) => unknown[]) => {
        queued.push(cb(() => {}))
      },
    } as unknown as AbstractSessionModel,
    queued,
  }
}

const region: Region = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 100,
  end: 200,
}

function menuItems(session: AbstractSessionModel, openTrackIds: string[] = []) {
  return syntenyRegionMenuItems({
    label: 'Launch',
    region,
    session,
    openTrackIds,
    anchorTracks: [],
  })
}

function dialogProps(queued: unknown[][]) {
  return queued[0]![1] as {
    region: Region
    tracks: { trackId: string; name: string }[]
  }
}

test('no synteny dataset for the assembly means no menu item', () => {
  const { session } = makeSession([track('t1', ['other', 'other2'])])
  expect(menuItems(session)).toEqual([])
})

test('no region means no menu item', () => {
  const { session } = makeSession([track('t1', ['volvox', 'volvox_ins'])])
  expect(
    syntenyRegionMenuItems({
      label: 'Launch',
      region: undefined,
      session,
      openTrackIds: [],
      anchorTracks: [],
    }),
  ).toEqual([])
})

// One item however many datasets there are: the choice between them is a field
// in the dialog, because this discovery is session-wide and has no ceiling.
test('one flat item queues the dialog with every dataset', () => {
  const { session, queued } = makeSession([
    track('t1', ['volvox', 'volvox_ins']),
    track('t2', ['volvox', 'volvox_del']),
  ])
  const items = menuItems(session)
  expect(items.length).toBe(1)
  const item = items[0]!
  expect('label' in item && item.label).toBe('Launch')
  if (!('onClick' in item)) {
    throw new Error('expected a flat item')
  }
  item.onClick()
  expect(dialogProps(queued).tracks.map(t => t.name)).toEqual(['t1', 't2'])
})

// A config can declare far more synteny tracks than a session opens, and the
// dialog opens on the first of this list — so it should be one the user has in
// front of them rather than whatever the config happened to declare first.
test('tracks open in the view sort ahead of the rest', () => {
  const { session, queued } = makeSession([
    track('closed', ['volvox', 'volvox_ins']),
    track('open', ['volvox', 'volvox_del']),
  ])
  const item = menuItems(session, ['open'])[0]!
  if (!('onClick' in item)) {
    throw new Error('expected a flat item')
  }
  item.onClick()
  expect(dialogProps(queued).tracks.map(t => t.name)).toEqual([
    'open',
    'closed',
  ])
})

// A dynamic block's bounds are fractional, and toLocale renders a fractional bp
// as `1,234,6.6,789` — which is what the visible-region launch put in the
// dialog title before this. The block's pixel bookkeeping goes with it, so what
// crosses the RPC boundary is a Region and nothing else.
test('a fractional block is rounded out to whole base pairs', () => {
  expect(
    toWholeBpRegion({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start: 12345.6789,
      end: 23456.789,
      offsetPx: 42.5,
      widthPx: 800,
      key: 'volvox:ctgA:12345.6789:23456.789:0',
    } as Region),
  ).toEqual({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 12345,
    end: 23457,
  })
})

// Both launch entries cross region boundaries routinely — a view scrolled past
// one, a rubberband dragged across one — and the shape getSelectedRegions
// returns for that drag is the shape this has to survive.
describe('widestRegion', () => {
  // typed rather than a bare [], which infers T as never and makes the call
  // read as a void expression
  const noBlocks: { start: number; end: number }[] = []

  test('no blocks means no region, so the menu item is absent', () => {
    expect(widestRegion(noBlocks)).toBeUndefined()
  })

  test('the leading sliver of a boundary-crossing selection loses', () => {
    expect(
      widestRegion([
        { refName: 'ctgA', start: 49998, end: 50001 },
        { refName: 'ctgB', start: 0, end: 9000 },
      ]),
    ).toEqual({ refName: 'ctgB', start: 0, end: 9000 })
  })

  test('a tie keeps the leftmost, so a symmetric straddle is stable', () => {
    expect(
      widestRegion([
        { refName: 'ctgA', start: 0, end: 100 },
        { refName: 'ctgB', start: 0, end: 100 },
      ]),
    ).toEqual({ refName: 'ctgA', start: 0, end: 100 })
  })

  test('a fractional dynamic block is compared on its real width', () => {
    expect(
      widestRegion([
        { refName: 'ctgA', start: 0.5, end: 10.5 },
        { refName: 'ctgB', start: 0.5, end: 9.4 },
      ]),
    ).toEqual({ refName: 'ctgA', start: 0.5, end: 10.5 })
  })
})

test('the queued dialog gets the rounded region', () => {
  const { session, queued } = makeSession([
    track('t1', ['volvox', 'volvox_ins']),
  ])
  const item = syntenyRegionMenuItems({
    label: 'Launch',
    region: { ...region, start: 100.4, end: 200.6 },
    session,
    openTrackIds: [],
    anchorTracks: [],
  })[0]!
  if (!('onClick' in item)) {
    throw new Error('expected a flat item')
  }
  item.onClick()
  const props = dialogProps(queued)
  expect(props.region.start).toBe(100)
  expect(props.region.end).toBe(201)
})
