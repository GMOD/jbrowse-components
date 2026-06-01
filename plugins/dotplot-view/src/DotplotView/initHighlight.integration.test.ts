import { createTestSession } from '@jbrowse/web/src/rootModel/index.js'
import { when } from 'mobx'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

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
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox' }],
      highlight: ['ctgA:5000-15000'],
    },
  })
  view.setWidth(800)

  await when(() => view.highlight.length > 0, { timeout: 15000 })

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
    init: {
      views: [
        { assembly: 'volvox', loc: 'ctgA:5000-15000' },
        { assembly: 'volvox' },
      ],
      highlight: ['ctgA:5000-15000'],
    },
  })
  view.setWidth(800)

  // loc-nav gates on initialized (regions populated), so wait for that
  await when(() => view.initialized, { timeout: 15000 })
  await when(() => view.highlight.length > 0, { timeout: 15000 })

  expect(view.highlight).toHaveLength(1)
  // the horizontal axis should have been moved off the whole-genome overview
  expect(view.hview.offsetPx).toBeGreaterThan(0)
  expect(notifyError).not.toHaveBeenCalled()
})
