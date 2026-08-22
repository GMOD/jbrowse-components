import '@testing-library/jest-dom'

import { readConfObject } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import { observer } from 'mobx-react'

import { measure } from './teardownNoise.ts'
import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

setup()

const config = volvoxConfigWithTracks(['volvox_test_vcf'])

beforeEach(() => {
  doBeforeEach()
})

// "Copy track" and friends live in a "Track actions" submenu, so a flat find
// misses them — which is how the bug below survived a hand check of the menu.
function flatten(items: MenuItem[]): { label?: string; disabled?: boolean }[] {
  return items.flatMap(i => [
    i as { label?: string; disabled?: boolean },
    ...('subMenu' in i ? flatten(i.subMenu) : []),
  ])
}

const delay = { timeout: 30000 }
const opts = [{}, delay] as const

// Taking a view out of a session destroyed it in place, inside the action, and
// MobX runs an action's pending reactions at the `endBatch` closing it — so
// everything mounted over that view got a final run against nodes that had just
// died. ADR-069's rule, at three call sites it had not been applied to.
//
// A view is worse than the session `setSession` fixed, because a DISPLAY is the
// thing rendering under it: `getContainingView` walks parents and throws when
// there is none, so where a session switch produced liveliness warnings on
// scalars, this produced `Error: no containing view found` into an
// ErrorBoundary — and with no view left to catch it, the boundary was the app's
// and the whole page went. The figure sweep saw exactly that on
// `cancer_sv/multihop_split_view`: the warnings, the throw, then a missing
// `[aria-label="JBrowse"]`.
//
// So both are asserted, and the throws separately from the warnings: they are
// two severities of one bug and only one of them takes the page. See
// teardownNoise.ts, shared with undoTeardown, which measures the same window at
// the other door into it.

// A track OPEN in the view, because that is what makes this measurable: a bare
// view has no display under it, and a display's reads are the ones that throw.
async function viewWithTrack() {
  const { view, session } = await createView(config)
  await view.navToLocString('ctgA:1..8000')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)
  return { view, session }
}

test('removeView does not read the view it took out', async () => {
  const { view, session } = await viewWithTrack()

  const log = measure(() => {
    session.removeView(view)
  })

  expect(log.thrown).toEqual([])
  expect(log.deadReads).toEqual([])

  // and it is really destroyed, not detached and forgotten: `beforeDestroy` is
  // where BaseTrackModel releases the rpcSessionId claim that lets
  // CoreFreeResources evict the parsed adapter from the worker, so a view that
  // stayed alive forever would leak one per closed view.
  await waitFor(() => {
    expect(isAlive(view)).toBe(false)
  }, delay)
}, 60000)

test('replaceView does not read the view it swapped out', async () => {
  const { view, session } = await viewWithTrack()

  const log = measure(() => {
    session.replaceView(view, 'LinearGenomeView')
  })

  expect(log.thrown).toEqual([])
  expect(log.deadReads).toEqual([])
  await waitFor(() => {
    expect(isAlive(view)).toBe(false)
  }, delay)
}, 60000)

// The same replace, seen a task later and through what is mounted BESIDE the
// view rather than under it — the window `measure` deliberately stops short of,
// and the one that actually took the page.
//
// A launch dialog resolves its source off a track, in its own render, and
// "Replace current view" destroys the view that track lives in. The dialog is
// still mounted while that happens, so the deferred destroy invalidates what it
// is observing and the re-render walks a dead node: `getContainingView` throws
// where a scalar read would only warn. `DialogQueue` renders under `App`, above
// every per-view boundary, so the throw reached jbrowse-web's own and the whole
// page became the fatal-error dialog. The figure sweep saw it as a missing
// `[aria-label="JBrowse"]` on `cancer_sv/multihop_split_view`.
//
// So the assertion is that the app is still there, not that nothing threw: the
// boundary this gates CATCHES the throw and reports it, which is the outcome
// being asked for.
test('a dialog holding a node in a replaced view does not take the page', async () => {
  const { view, session } = await viewWithTrack()
  const track = view.tracks[0]

  const SourceReadingDialog = observer(function SourceReadingDialog() {
    // subscribed to the tree that is about to die, which is what makes the
    // destroy re-render this rather than leave it holding a stale frame
    const count = track.displays.length
    getContainingView(track)
    return <div data-testid="source-reading-dialog">{count}</div>
  })

  session.queueDialog(() => [SourceReadingDialog, {}])
  await screen.findByTestId('source-reading-dialog', ...opts)

  act(() => {
    session.replaceView(view, 'LinearGenomeView')
  })
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })

  expect(screen.queryByText('Fatal error')).toBeNull()
  expect(screen.getByTestId('app-bar')).toBeTruthy()
}, 60000)

// The half of the detach that would have broken silently, and the reason
// `beforeDetach` carries this rather than `beforeDestroy` alone. A comparative
// view synthesizes a read-vs-ref assembly nothing else owns, and gives it back
// when it closes. Detach the view first and that hook runs on a root, where
// `getSession` throws — so `releaseTemporaryAssemblies` guards on `hasParent`,
// and a guard is exactly the shape that turns a broken teardown into a leak
// with nothing said. This is the assertion that would notice.
test('a comparative view gives its temporary assembly back when removed', async () => {
  const { session } = await createView(config)

  session.addTemporaryAssembly({
    name: 'readvsref',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'readvsref-ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'readvsref',
            uniqueId: 'readvsref-1',
            start: 0,
            end: 10,
            seq: 'ACGTACGTAC',
          },
        ],
      },
    },
  })
  expect(session.temporaryAssemblies.map(a => a.name)).toContain('readvsref')

  const dotplot = await session.launchView('DotplotView', {
    assemblyNames: ['readvsref'],
  })
  act(() => {
    session.removeView(dotplot)
  })

  expect(session.temporaryAssemblies.map(a => a.name)).not.toContain(
    'readvsref',
  )
}, 60000)

// The other half of what a comparative view brings in, and the reason nothing
// here sweeps a session list for it. A view that synthesizes a track only it can
// draw — a read-vs-ref synteny band, the segment labels of a derivative allele —
// hands the config to `showTrack` rather than to any session list, so the config
// lives on the track that draws it. A list outside the view would need somebody
// to come back and sweep it, and each list that tried grew its own cleanup: the
// dotplot's `clearView` cleared one by hand, `LinearComparativeView.clearView`
// forgot to, and a per-launch segments track sat in `sessionTracks` after its
// assembly was gone.
test('a view-local track config goes out with the view', async () => {
  const { session } = await createView(config)

  session.addTemporaryAssembly({
    name: 'readvsref',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'readvsref-ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'readvsref',
            uniqueId: 'readvsref-1',
            start: 0,
            end: 10,
            seq: 'ACGTACGTAC',
          },
        ],
      },
    },
  })

  const synteny = (await session.launchView('LinearSyntenyView', {
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 100 },
        ],
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          {
            assemblyName: 'readvsref',
            refName: 'readvsref',
            start: 0,
            end: 10,
          },
        ],
      },
    ],
  })) as unknown as {
    views: {
      showTrack: (
        id: string,
        initialSnapshot?: object,
        displaySnapshot?: object,
        inlineConf?: Record<string, unknown>,
      ) => unknown
      launchTrack: (
        id: string,
        initialSnapshot?: object,
        displaySnapshot?: object,
        inlineConf?: Record<string, unknown>,
      ) => Promise<unknown>
      tracks: { configuration: AnyConfigurationModel }[]
    }[]
  }

  await act(async () => {
    await synteny.views[1]!.launchTrack(
      'view-local',
      {},
      {},
      {
        type: 'FeatureTrack',
        trackId: 'view-local',
        name: 'segments',
        assemblyNames: ['readvsref'],
        adapter: {
          type: 'FromConfigAdapter',
          features: [
            { refName: 'readvsref', uniqueId: 's1', start: 0, end: 5 },
          ],
        },
      },
    )
  })

  // resolved, and from the track rather than from anything the session holds
  const { configuration } = synteny.views[1]!.tracks[0]!
  expect(readConfObject(configuration, 'name')).toBe('segments')
  expect(session.getTrackById('view-local')).toBeUndefined()
  expect(session.sessionTracks).toHaveLength(0)

  // ...and the menu offers no way to put it in one. "Copy track" stamps a fresh
  // trackId and hands the snapshot to `addTrackConf`, which for an admin — which
  // this harness is — writes into the config.json every visitor is served, so a
  // copy of a track on a synthetic assembly published one dead entry per click.
  // The unit half is `temporaryAssemblyTracks.test.ts`; this is the wiring, which
  // is what says a real view-local track reaches that predicate at all.
  const menu = flatten(
    session.getTrackActionMenuItems({
      config: configuration,
      view: synteny.views[1],
    }),
  )
  expect(menu.find(i => i.label === 'Copy track')).toHaveProperty(
    'disabled',
    true,
  )
  expect(menu.find(i => i.label === 'Copy and open track')).toHaveProperty(
    'disabled',
    true,
  )

  act(() => {
    session.removeView(synteny as unknown as AbstractViewModel)
  })
  await act(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 0)
    })
  })

  expect(session.sessionTracks).toHaveLength(0)
  expect(session.temporaryAssemblies).toHaveLength(0)
  expect(screen.getByTestId('app-bar')).toBeTruthy()
}, 60000)

// The other direction, and the one the sweep this replaced was trying to protect:
// the snapshot a user SAVES and SHARES. A config referenced by id from a sibling
// list is two things in that snapshot that can be dropped independently; inline it
// is one, so the round trip is what says the track comes back drawable rather than
// naming an id nothing resolves. Through the level rather than an LGV panel,
// because that is where the read-vs-ref launchers put their synthesized band.
test('an inline view-local config survives a session round trip', async () => {
  const inlineConf = {
    type: 'SyntenyTrack',
    trackId: 'view-local-synteny',
    name: 'read vs ref',
    assemblyNames: ['volvox', 'readvsref'],
    adapter: {
      type: 'FromConfigAdapter',
      features: [
        {
          uniqueId: 'a1',
          refName: 'ctgA',
          start: 0,
          end: 50,
          strand: 1,
          syntenyId: 0,
          mate: { refName: 'readvsref', start: 0, end: 50, name: 'readvsref' },
        },
      ],
    },
  }
  const viewSnap = {
    type: 'LinearSyntenyView',
    views: [
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50 },
        ],
      },
      {
        type: 'LinearGenomeView',
        displayedRegions: [
          {
            assemblyName: 'readvsref',
            refName: 'readvsref',
            start: 0,
            end: 50,
          },
        ],
      },
    ],
  }

  const first = await createView(config)
  first.session.addTemporaryAssembly({
    name: 'readvsref',
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: 'readvsref-ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'readvsref',
            uniqueId: 'readvsref-1',
            start: 0,
            end: 50,
            seq: 'A'.repeat(50),
          },
        ],
      },
    },
  })
  const built = (await first.session.launchView(
    'LinearSyntenyView',
    viewSnap,
  )) as unknown as {
    launchTrack: (
      trackId: string,
      level?: number,
      initialSnapshot?: object,
      displaySnapshot?: object,
      inlineConf?: Record<string, unknown>,
    ) => Promise<unknown>
  }
  await act(async () => {
    await built.launchTrack('view-local-synteny', 0, {}, {}, inlineConf)
  })

  // what a share link carries: JSON, so anything MST could not serialize is gone
  const saved = JSON.parse(
    JSON.stringify(getSnapshot(first.session as unknown as IAnyStateTreeNode)),
  ) as {
    views: { levels?: { tracks?: { configuration: unknown }[] }[] }[]
    sessionTracks?: unknown[]
  }
  // the config is IN the track, and no session list holds a copy
  expect(saved.views[1]!.levels![0]!.tracks![0]!.configuration).toMatchObject({
    trackId: 'view-local-synteny',
  })
  expect(saved.sessionTracks ?? []).toHaveLength(0)

  cleanup()

  // ...and a fresh app served that session draws the same track
  const second = await createView({ ...config, defaultSession: saved })
  const restored = second.session.views[1] as unknown as {
    levels: { tracks: { configuration: AnyConfigurationModel }[] }[]
  }
  const conf = restored.levels[0]!.tracks[0]!.configuration
  expect(readConfObject(conf, 'name')).toBe('read vs ref')
  expect(readConfObject(conf, 'assemblyNames')).toEqual(['volvox', 'readvsref'])
  expect(readConfObject(conf, ['adapter', 'features'])).toHaveLength(1)
  // still nowhere in the session, which is what keeps it out of every selector
  expect(second.session.getTrackById('view-local-synteny')).toBeUndefined()
  expect(screen.getByTestId('app-bar')).toBeTruthy()
}, 60000)
