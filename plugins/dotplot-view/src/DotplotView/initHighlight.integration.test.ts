import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Real assembly manager: addAssemblyConf kicks off async loading, so the init
// autorun runs while isValidRefName still throws "assembly has not finished
// loading". This is the race that the synchronous highlight-parse hit; the test
// proves init waits for the assembly and applies highlights/loc without error.
function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 16000,
            seq: 'a'.repeat(16000),
          },
        ],
      },
    },
  })
  return session
}

test('init.highlight is applied after the assembly finishes loading', async () => {
  const session = setup()
  const notifyError = jest.spyOn(session, 'notifyError')
  const view = session.addView('DotplotView', {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
    highlight: ['ctgA:5000-15000'],
  })
  view.setWidth(800)
  // await the one async precondition rather than polling for it; see the note
  // in SVGDotplotView.test.tsx on why the inner 15s deadline is gone
  await session.assemblyManager.waitForAssembly('volvox')

  await when(() => view.highlight.length > 0)

  expect(view.highlight[0]).toMatchObject({
    refName: 'ctgA',
    assemblyName: 'volvox',
  })
  // the load race must not surface as an error
  expect(notifyError).not.toHaveBeenCalled()
})

test('init loc navigation runs once regions exist, and highlight still applies', async () => {
  const session = setup()
  const notifyError = jest.spyOn(session, 'notifyError')
  const view = session.addView('DotplotView', {
    views: [
      { assembly: 'volvox', loc: 'ctgA:5000-15000' },
      { assembly: 'volvox' },
    ],
    highlight: ['ctgA:5000-15000'],
  })
  view.setWidth(800)
  // await the one async precondition rather than polling for it; see the note
  // in SVGDotplotView.test.tsx on why the inner 15s deadline is gone
  await session.assemblyManager.waitForAssembly('volvox')

  // loc-nav gates on initialized (regions populated), so wait for that
  await when(() => view.initialized)
  await when(() => view.highlight.length > 0)

  expect(view.highlight).toHaveLength(1)
  // the horizontal axis should have been moved off the whole-genome overview
  expect(view.hview.offsetPx).toBeGreaterThan(0)
  expect(notifyError).not.toHaveBeenCalled()
})

// A bad entry used to throw out of applyInitHighlights into the autorun's
// catch, which skipped every init step that runs after highlights (loc-nav
// among them) and cleared init. Each entry now fails on its own.
test('a bad init.highlight entry keeps its siblings and the loc-nav after it', async () => {
  const session = setup()
  const notifyError = jest.spyOn(session, 'notifyError').mockImplementation()
  const consoleError = jest.spyOn(console, 'error').mockImplementation()
  const view = session.addView('DotplotView', {
    views: [
      { assembly: 'volvox', loc: 'ctgA:5000-15000' },
      { assembly: 'volvox' },
    ],
    highlight: ['ctgA:1000-2000', 'nonexistent:1-2', 'ctgA:8000-9000'],
  })
  view.setWidth(800)
  // await the one async precondition rather than polling for it; see the note
  // in SVGDotplotView.test.tsx on why the inner 15s deadline is gone
  await session.assemblyManager.waitForAssembly('volvox')

  await when(() => view.initialized)
  await when(() => view.highlight.length === 2)

  // the two good entries survived the bad one between them
  expect(view.highlight.map((h: { start: number }) => h.start)).toEqual([
    999, 7999,
  ])
  // and the loc-nav that runs after highlights still happened
  expect(view.hview.offsetPx).toBeGreaterThan(0)
  expect(notifyError).toHaveBeenCalledTimes(1)
  expect(consoleError).toHaveBeenCalled()
})

test('a bad per-axis init loc leaves the other axis navigated', async () => {
  const session = setup()
  const notifyError = jest.spyOn(session, 'notifyError').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  const view = session.addView('DotplotView', {
    views: [
      { assembly: 'volvox', loc: 'nonexistent:1-2' },
      { assembly: 'volvox', loc: 'ctgA:5000-15000' },
    ],
  })
  view.setWidth(800)
  // await the one async precondition rather than polling for it; see the note
  // in SVGDotplotView.test.tsx on why the inner 15s deadline is gone
  await session.assemblyManager.waitForAssembly('volvox')

  await when(() => view.initialized)
  // the whole point: axis 0 throws first, and before the per-axis catch that
  // aborted the loop, so axis 1 never navigated and this would time out
  await when(() => view.vview.offsetPx > 0)

  expect(notifyError).toHaveBeenCalledTimes(1)
  // the plot materialized, so init is consumed rather than kept for a retry
  expect(view.pendingLaunch).toBeUndefined()
})
