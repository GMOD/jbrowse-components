import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'volvox-ctgA',
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
}

function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  return session
}

test('an unloadable assembly reports instead of spinning forever', async () => {
  const session = setup()
  const view = (await session.launchView('BreakpointSplitView', {
    init: [{ assembly: 'volvox', loc: 'ctgA:1-100' }, { assembly: 'nope' }],
  })) as BreakpointViewModel
  view.setWidth(800)

  await when(() => !!view.error)

  // `initialized` folds in every row's assembly, so it can never become true
  // here. The spinner it used to gate is unreachable state; the import form,
  // whose banner reports this error, is the only way forward.
  expect(view.initialized).toBe(false)
  expect(view.showLoading).toBe(false)
  expect(view.showImportForm).toBe(true)
  // and an export doesn't hang behind that spinner waiting on `initialized`
  await expect(view.exportSvg()).rejects.toThrow(/Cannot export/)
})

test('rows that load leave the view usable', async () => {
  const session = setup()
  const view = (await session.launchView('BreakpointSplitView', {
    init: [
      { assembly: 'volvox', loc: 'ctgA:1-100' },
      { assembly: 'volvox', loc: 'ctgA:200-300' },
    ],
  })) as BreakpointViewModel
  view.setWidth(800)

  // await the one async precondition rather than polling for it; see the note
  // in SVGDotplotView.test.tsx on why the inner 15s deadline is gone
  await session.assemblyManager.waitForAssembly('volvox')
  await when(() => view.initialized)

  expect(view.error).toBeUndefined()
  expect(view.showLoading).toBe(false)
  expect(view.showImportForm).toBe(false)
})
