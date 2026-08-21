import { destroy, types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import DerivativeVsRefDialog from './LinearDerivativeVsRef.tsx'
import { derivativePathTestIds } from './buildDerivativeVsRefSpec.ts'
import { MAX_SPLIT_PANELS } from './buildSplitViewFromPath.ts'

import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

function route(segmentCount: number, refName = 'chr3'): DerivativeCandidate {
  return {
    segments: Array.from({ length: segmentCount }, (_, i) => ({
      refName,
      start: i * 10_000,
      end: i * 10_000 + 500,
      strand: 1,
    })),
    readCount: 4,
    pathId: `${refName}-${segmentCount}`,
    locString: '',
    refNames: [refName],
    extendsOffScreen: false,
  }
}

// `isSessionModel` asks for `rpcManager` and `configuration`; `isViewModel` asks
// for `width` and `setWidth`. So the dialog's two walks off `track` resolve
// against a three-node tree and nothing more.
function makeTrack() {
  const View = types
    .model('View', { track: types.model('Track', { id: types.identifier }) })
    .views(() => ({
      get width() {
        return 800
      },
    }))
    .actions(() => ({ setWidth() {} }))
  const session = types
    .model('Session', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      view: View,
    })
    .create({
      rpcManager: {},
      configuration: {},
      view: { track: { id: 't1' } },
    })
  return {
    session,
    track: session.view.track as unknown as AbstractTrackModel,
  }
}

// "Replace current view" detaches the launching view and destroys it a task
// later, and BOTH `track` and `model` live in it. The props' `getSession` /
// `getContainingView` walks throw from a destroyed node, out of `DialogQueue`,
// which sits above every per-view ErrorBoundary; `model.derivativePathCandidates`
// is the quieter half, warning from `assertAlive` and handing back a stale list.
//
// So what the guard has to do is stop the render before ANY of it. It used to
// sit below the derivations, where the quiet half ran first — which the old
// version of this test could not see, because it passed a plain object as
// `model` and a plain object cannot die with the tree.
test('a dead track stops the render before the model is read', () => {
  // the whole tree, which is what a replace destroys: the view goes, and `track`
  // and `model` go with it
  const { session, track } = makeTrack()
  destroy(session)

  let reads = 0
  const model = {
    get derivativePathCandidates() {
      reads++
      return []
    },
    get hasReadsForDerivativePaths() {
      reads++
      return true
    },
  }

  const { container } = render(
    <DerivativeVsRefDialog
      model={model}
      track={track}
      handleClose={() => {}}
    />,
  )

  expect(container.innerHTML).toBe('')
  expect(reads).toBe(0)
})

// One panel per segment is one pileup fetch per segment, and nothing upstream
// bounds the count — a real ngmlr-aligned ONT record in COLO829 carries 943 SA
// entries. Disabled rather than truncated: a prefix of a path drawn under the
// whole path's name is worse than not drawing it.
describe('the split drawing above the panel cap', () => {
  function open(candidates: DerivativeCandidate[]) {
    return render(
      <DerivativeVsRefDialog
        model={{
          derivativePathCandidates: candidates,
          hasReadsForDerivativePaths: true,
        }}
        track={makeTrack().track}
        handleClose={() => {}}
      />,
    )
  }
  const radio = (testId: string) =>
    screen.getByTestId(testId).querySelector('input')!

  it('is offered for a route it fits', () => {
    open([route(MAX_SPLIT_PANELS), route(2, 'chr9')])
    expect(radio('derivative-draw-as-split').disabled).toBe(false)
  })

  it('is refused, with the count, one segment past it', () => {
    open([route(MAX_SPLIT_PANELS + 1), route(2, 'chr9')])
    expect(radio('derivative-draw-as-split').disabled).toBe(true)
    // the count, because the reason is a fact about the route rather than about
    // the control. Matched on the sentence's own words: the row above the
    // control already prints "13 segments" as part of its evidence line.
    expect(
      screen.getByText(
        new RegExp(`${MAX_SPLIT_PANELS + 1} segments is one panel per segment`),
      ),
    ).toBeTruthy()
  })

  // The two radio groups are separate questions, so moving onto a route the
  // split drawing cannot take must not carry the answer with it — and must not
  // discard it either, since the reader gets it back on a route that fits.
  it('falls back to synteny when the picked route outgrows it', () => {
    const routes = [route(2), route(MAX_SPLIT_PANELS + 1, 'chr9')]
    open(routes)
    fireEvent.click(radio('derivative-draw-as-split'))
    expect(radio('derivative-draw-as-split').checked).toBe(true)

    fireEvent.click(radio(derivativePathTestIds(routes)[1]!))
    expect(radio('derivative-draw-as-synteny').checked).toBe(true)
    expect(radio('derivative-draw-as-split').disabled).toBe(true)
  })
})

// `addTrackConf` is two destinations behind one name: an admin's track goes into
// `jbrowse.tracks`, which the admin server writes back into the config.json every
// visitor is served. The segments track is a per-launch `FromConfigAdapter` over a
// temporary assembly, so that published one dead `derivative-segments-<stamp>` per
// click, naming an assembly that never existed outside one session.
test('the segments track goes to the session, not the shared config', async () => {
  const Panel = types
    .model('Panel', { id: types.identifier })
    .volatile(() => ({ shown: [] as string[] }))
    .views(() => ({
      get initialized() {
        return true
      },
    }))
    .actions(self => ({
      showTrack(trackId: string) {
        self.shown.push(trackId)
      },
    }))
  const calls: string[] = []
  const Session = types
    .model('Session', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      panels: types.array(Panel),
      view: types
        .model('View', {
          track: types.model('Track', {
            id: types.identifier,
            configuration: types.frozen<Record<string, unknown>>(),
          }),
        })
        .views(() => ({
          get width() {
            return 800
          },
        }))
        .actions(() => ({ setWidth() {} })),
    })
    .volatile(self => ({
      assemblyManager: {
        waitForAssembly: () =>
          Promise.resolve({
            configuration: { sequence: { trackId: 'hg38-seq' } },
          }),
      },
      addView: () => ({ views: self.panels }),
    }))
    .actions(() => ({
      addTemporaryAssembly() {},
      addTrackConf(conf: { trackId: string }) {
        calls.push(`shared:${conf.trackId}`)
      },
      addSessionTrackConf(conf: { trackId: string }) {
        calls.push(`session:${conf.trackId}`)
      },
    }))
    .create({
      rpcManager: {},
      configuration: {},
      panels: [{ id: 'ref' }, { id: 'derivative' }],
      view: {
        track: { id: 't1', configuration: { assemblyNames: ['hg38'] } },
      },
    })

  render(
    <DerivativeVsRefDialog
      model={{
        derivativePathCandidates: [route(2)],
        hasReadsForDerivativePaths: true,
      }}
      track={Session.view.track as unknown as AbstractTrackModel}
      handleClose={() => {}}
    />,
  )
  await act(async () => {
    fireEvent.click(screen.getByText('Open in new view'))
  })

  // one destination reached, and the session's
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatch(/^session:derivative-segments-/)
  // the second panel is the derivative axis, and the labels go onto it
  expect(Session.panels[1]!.shown).toEqual([calls[0]!.split(':')[1]])
  expect(Session.panels[0]!.shown).toEqual([])
})
