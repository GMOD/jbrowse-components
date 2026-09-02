import { destroy, types } from '@jbrowse/mobx-state-tree'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import DerivativeVsRefDialog from './LinearDerivativeVsRef.tsx'
import { derivativePathTestIds } from './buildDerivativeVsRefSpec.ts'
import { MAX_SPLIT_PANELS } from './buildSplitViewFromPath.ts'

import type { AbstractTrackModel } from '@jbrowse/core/util'
import type { DerivativeCandidate } from '@jbrowse/plugin-alignments'

// what a read pileup is; `LGVSyntenyDisplay` answers this with contigs
const READS = { noun: 'reads', minReads: 2, namesOffScreenSegments: true }

// A long-read library's median aligned length, so a fixture that is not about
// the empty state gets the wording every other one gets.
const ONT_SPAN_BP = 18_000

// The flank a real candidate carries on the path's two outer edges, so anything
// rendering one of these meets the same gap between drawn and observed that the
// picker's row has to get right.
const FLANK = 2000

function route(segmentCount: number, refName = 'chr3'): DerivativeCandidate {
  const observedSegments = Array.from({ length: segmentCount }, (_, i) => ({
    refName,
    start: i * 10_000,
    end: i * 10_000 + 500,
    strand: 1,
  }))
  return {
    observedSegments,
    segments: observedSegments.map((seg, i) => ({
      ...seg,
      start: i === 0 ? seg.start - FLANK : seg.start,
      end: i === observedSegments.length - 1 ? seg.end + FLANK : seg.end,
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
    derivativePathEvidence: READS,
    medianReadSpanBp: ONT_SPAN_BP,
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
// The row's sizes are the evidence, not the picture. The caveat above the list
// tells a reader to spot an aligner artefact by its segments all being about one
// read long, and the flank the candidate carries for drawing lands on exactly
// the two segments a short-read path has — so a row reading `segments` reports
// two comfortable kilobase blocks for two hundred bases of evidence, and the
// check the caveat asks for cannot come out false.
test('the row sizes what the reads saw, not what the view will open on', () => {
  render(
    <DerivativeVsRefDialog
      model={{
        derivativePathCandidates: [route(2)],
        hasReadsForDerivativePaths: true,
        derivativePathEvidence: READS,
        medianReadSpanBp: ONT_SPAN_BP,
      }}
      track={makeTrack().track}
      handleClose={() => {}}
    />,
  )
  // 500bp segments, twice — not the 2.5Kbp each carries once flanked
  expect(screen.getByText(/500bp, 500bp/)).toBeTruthy()
  expect(screen.queryByText(/2\.5Kbp/)).toBeNull()
})

// The lettered string is the row's headline: `route(2)` is two pieces of chr3
// with the reference between them skipped, which is a deletion, and a deletion
// is written A C.
test('the row leads with the derivative as a lettered string', () => {
  render(
    <DerivativeVsRefDialog
      model={{
        derivativePathCandidates: [route(2)],
        hasReadsForDerivativePaths: true,
        derivativePathEvidence: READS,
        medianReadSpanBp: ONT_SPAN_BP,
      }}
      track={makeTrack().track}
      handleClose={() => {}}
    />,
  )
  // the dialog renders in a portal, so the body is where its text is
  expect(document.body.textContent).toContain('A Cchr3 → chr3')
})

test('the segment map saves as an SVG named for the route', () => {
  const blobs: Blob[] = []
  const names: string[] = []
  const createObjectURL = jest.fn((blob: Blob) => {
    blobs.push(blob)
    return 'blob:segment-map'
  })
  Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() })
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
  render(
    <DerivativeVsRefDialog
      model={{
        derivativePathCandidates: [route(2)],
        hasReadsForDerivativePaths: true,
        derivativePathEvidence: READS,
        medianReadSpanBp: ONT_SPAN_BP,
      }}
      track={makeTrack().track}
      handleClose={() => {}}
    />,
  )
  fireEvent.click(screen.getByTestId('derivative-save-segment-map'))
  expect(blobs).toHaveLength(1)
  expect(blobs[0]!.type).toBe('image/svg+xml')
  click.mockRestore()
})

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
          derivativePathEvidence: READS,
          medianReadSpanBp: ONT_SPAN_BP,
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

// The segments track is a per-launch `FromConfigAdapter` over a temporary
// assembly, so no list outside this view has any use for its config and any list
// that holds one needs somebody to come back and sweep it. Both destinations this
// could have used are wrong for that reason: `publishTrackConf` puts an admin's
// into the config.json every visitor is served, and `addSessionTrackConf` leaves a
// dead `derivative-segments-<stamp>` in the snapshot the user saves and shares —
// one more per click, since the stamp defeats the dedupe. So the assertion is that
// NEITHER is reached and the config arrives on the track itself.
test('the segments config rides on the track, reaching no session list', async () => {
  const shownConfs: (Record<string, unknown> | undefined)[] = []
  const Panel = types
    .model('Panel', { id: types.identifier })
    .volatile(() => ({ shown: [] as string[] }))
    .views(() => ({
      get initialized() {
        return true
      },
    }))
    .actions(self => ({
      showTrack(
        trackId: string,
        _initialSnapshot?: object,
        _displaySnapshot?: object,
        inlineConf?: Record<string, unknown>,
      ) {
        self.shown.push(trackId)
        shownConfs.push(inlineConf)
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
      publishTrackConf(conf: { trackId: string }) {
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
        derivativePathEvidence: READS,
        medianReadSpanBp: ONT_SPAN_BP,
      }}
      track={Session.view.track as unknown as AbstractTrackModel}
      handleClose={() => {}}
    />,
  )
  await act(async () => {
    fireEvent.click(screen.getByText('Open in new view'))
  })

  // no session list touched
  expect(calls).toEqual([])
  // the second panel is the derivative axis, and the labels go onto it
  expect(Session.panels[0]!.shown).toEqual([])
  expect(Session.panels[1]!.shown).toEqual([
    expect.stringMatching(/^derivative-segments-/),
  ])
  // ...carrying their own config, over the synthetic axis and nothing else
  expect(shownConfs).toHaveLength(1)
  expect(shownConfs[0]).toMatchObject({
    trackId: Session.panels[1]!.shown[0],
    adapter: { type: 'FromConfigAdapter' },
  })
  expect(
    (shownConfs[0] as { assemblyNames: string[] }).assemblyNames,
  ).not.toContain('hg38')
})

// An empty list means one of two opposite things and the dialog used to give
// only one of them. On a 150 bp library the advice it gave — navigate to a
// breakpoint, widen the window — is work with no possible result, since the
// reads cannot carry a junction at any window. The picker is the only place a
// reader is told that: the ranked list they would otherwise read it off is the
// thing that is empty.
describe('the empty list says which kind of empty it is', () => {
  function openEmpty(medianReadSpanBp: number, evidence = READS) {
    return render(
      <DerivativeVsRefDialog
        model={{
          derivativePathCandidates: [],
          hasReadsForDerivativePaths: true,
          derivativePathEvidence: evidence,
          medianReadSpanBp,
        }}
        track={makeTrack().track}
        handleClose={() => {}}
      />,
    )
  }

  it('names the measured length on a short-read library', () => {
    openEmpty(151)
    expect(screen.getByText(/151 bp at the median/)).toBeTruthy()
    // ...and drops the advice that sent that reader looking
    expect(screen.queryByText(/widen the window if the reads are long/)).toBe(
      null,
    )
  })

  it('keeps the where-to-look advice on a long-read library', () => {
    openEmpty(ONT_SPAN_BP)
    expect(
      screen.getByText(/widen the window if the reads are long/),
    ).toBeTruthy()
    expect(screen.queryByText(/at the median/)).toBe(null)
  })

  // The boundary is stated rather than tuned (SHORT_READ_SPAN_BP), so both
  // sides of it are pinned: one base under is short, the kilobase itself is
  // not. A test that only checked 150 would pass against a threshold of 200.
  it('turns over at the stated kilobase', () => {
    openEmpty(999)
    expect(screen.getByText(/999 bp at the median/)).toBeTruthy()
    cleanup()
    openEmpty(1000)
    expect(screen.queryByText(/at the median/)).toBe(null)
  })

  it('leaves a synteny track its own answer, whatever its blocks measure', () => {
    // A PAF block is not a read and names nothing off screen, so the short-read
    // sentence would be false about it at any length — the branch is on the
    // evidence, not on the number.
    openEmpty(300, {
      noun: 'contigs',
      minReads: 1,
      namesOffScreenSegments: false,
    })
    expect(screen.getByText(/one region each/)).toBeTruthy()
    expect(screen.queryByText(/at the median/)).toBe(null)
  })

  // The state a `force load` window lands in reads 0, and 0 is not short — it
  // is unmeasured. It never reaches here (`hasReadsForDerivativePaths` answers
  // first), and this is what keeps that true if the guard above ever moves.
  it('does not call an unloaded window short', () => {
    openEmpty(0)
    expect(screen.queryByText(/at the median/)).toBe(null)
  })
})
