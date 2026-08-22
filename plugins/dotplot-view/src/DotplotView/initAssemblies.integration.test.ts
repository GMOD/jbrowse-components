import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { DotplotViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// What an init may say about its two axes. Both wrong answers here are silent:
// pushing an unnamed axis into `assemblyNames` (`types.array(types.string)`)
// throws an MST type error the view renders as a banner over itself, which is
// how both import-form figures shipped; and treating an init that names nothing
// as malformed makes the import form unreachable from a session spec.
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
  const view = (await session.launchView('DotplotView', {
    init: { views },
  })) as DotplotViewModel
  view.setWidth(800)
  return view
}

// `[{}, {}]` is what sv_synteny/dotplot_import asks for, `[]` is what a bare
// `{type: 'DotplotView'}` spec becomes. Both mean "open a dotplot and let me
// choose".
test.each([
  ['two axes naming no assembly', [{}, {}]],
  ['no axes at all', []],
])('%s opens the import form, with no error', async (_name, views) => {
  const session = setup()
  const notify = jest.spyOn(session, 'notifyError')
  const view = await launch(session, views)

  // consumed, not kept: a retry could not launch it either
  await when(() => view.init === undefined)
  expect(view.assemblyNames).toHaveLength(0)
  expect(notify).not.toHaveBeenCalled()
})

// Half a pair is not the same as no pair: the user named something specific
// that cannot be honoured, so say so instead of silently dropping it.
test.each([
  ['only the first axis named', [{ assembly: 'volvox' }, {}]],
  ['only the second axis named', [{}, { assembly: 'volvox' }]],
  ['one axis in total', [{ assembly: 'volvox' }]],
])('%s is reported as malformed', async (_name, views) => {
  const session = setup()
  const notify = jest.spyOn(session, 'notifyError')
  const view = await launch(session, views)

  await when(() => view.init === undefined)
  expect(notify).toHaveBeenCalledWith(
    expect.stringContaining('an assembly on each of its two views'),
  )
  expect(view.assemblyNames).toHaveLength(0)
})

test('both axes named launches the plot', async () => {
  const session = setup()
  const notify = jest.spyOn(session, 'notifyError')
  const view = await launch(session, [
    { assembly: 'volvox' },
    { assembly: 'volvox' },
  ])

  await when(() => view.assemblyNames.length > 0)
  expect([...view.assemblyNames]).toEqual(['volvox', 'volvox'])
  expect(notify).not.toHaveBeenCalled()
})
