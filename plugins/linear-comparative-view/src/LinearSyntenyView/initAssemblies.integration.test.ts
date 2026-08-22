import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// What an init may say about its rows, which is the same question DotplotView's
// initAssemblies test pins for its two axes. The wrong answer here was not
// silent but it was worse: an unnamed row reached
// `assemblyManager.waitForAssembly(undefined)`, whose own guard throws, so the
// view rendered "no assembly name supplied to waitForAssembly" as a banner over
// the import form it had fallen back to -- and a session spec had no other way
// to ask for that form, since `launchSyntenyView` requires two rows to launch at
// all.
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

async function launch(session: ReturnType<typeof setup>, views: unknown[]) {
  const view = (await session.launchView('LinearSyntenyView', {
    init: { views },
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  return view
}

// Two empty rows is what a spec asking for the import form has to send, since
// `launchSyntenyView` rejects fewer than two. Three is the same request from the
// stack this view exists for.
test.each([
  ['two rows naming no assembly', [{}, {}]],
  ['three rows naming no assembly', [{}, {}, {}]],
])('%s opens the import form, with no error', async (_name, views) => {
  const session = setup()
  const notify = jest.spyOn(session, 'notifyError')
  const view = await launch(session, views)

  // consumed, not kept: a retry could not launch it either
  await when(() => view.init === undefined)
  expect(view.views).toHaveLength(0)
  expect(view.error).toBeUndefined()
  expect(notify).not.toHaveBeenCalled()
})

// Some but not all is not the same as none: the user named something specific
// that cannot be honoured, so say so instead of silently dropping it.
test.each([
  ['only the first row named', [{ assembly: 'volvox' }, {}]],
  ['only the second row named', [{}, { assembly: 'volvox' }]],
  [
    'the middle row of three unnamed',
    [{ assembly: 'volvox' }, {}, { assembly: 'volvox' }],
  ],
])('%s is reported as malformed', async (_name, views) => {
  const session = setup()
  const notify = jest.spyOn(session, 'notifyError')
  const view = await launch(session, views)

  await when(() => view.init === undefined)
  expect(notify).toHaveBeenCalledWith(
    expect.stringContaining('an assembly on every one of its views'),
  )
  expect(view.views).toHaveLength(0)
})

test('every row named builds the rows', async () => {
  const session = setup()
  const notify = jest.spyOn(session, 'notifyError')
  const view = await launch(session, [
    { assembly: 'volvox' },
    { assembly: 'volvox' },
  ])

  await when(() => view.views.length > 0)
  expect(view.views).toHaveLength(2)
  expect(notify).not.toHaveBeenCalled()
})
