import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { waitFor } from '@testing-library/react'

import { utilizeFetchMockForTest, volvoxGetFile } from './generateReadBuffer.ts'
import { getPluginManager, setup } from './util.tsx'

setup()

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

jest.mock('../makeWorkerInstance', () => () => {})

// Flush any pending dynamic-import microtasks before Jest tears down the env,
// otherwise the lazy assembly adapter import started by the embedded circular
// view resolves after teardown and throws "require after Jest environment has
// been torn down".
afterEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 100))
})

utilizeFetchMockForTest(volvoxGetFile)

function createSvInspectorViewWithInit(init: {
  assembly: string
  uri: string
  fileType?: string
}) {
  const { pluginManager, rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SvInspectorView', { init })

  return { view, session, rootModel, pluginManager }
}

test('SvInspectorView initializes its spreadsheet from init', async () => {
  const { view } = createSvInspectorViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })

  await waitFor(
    () => {
      expect(view.spreadsheetView.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )

  expect(view.spreadsheetView.spreadsheet?.assemblyName).toBe('volvox')
  expect(view.init).toBeUndefined()
}, 40000)

// Regression: SvInspector clears its own init synchronously after forwarding it
// to the child spreadsheet (which caches the file location synchronously). So a
// snapshot taken before the async load finishes carries no init on either node,
// yet still reloads via the child's persisted cachedFileLocation rather than
// stranding on the import form. This is why SvInspector can strip init
// unconditionally where the async-materializing views must keep it.
test('snapshot forwards init to child spreadsheet synchronously', () => {
  const { view } = createSvInspectorViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.dup.vcf.gz',
  })

  const snap: {
    init?: unknown
    spreadsheetView: {
      init?: unknown
      importWizard: { cachedFileLocation?: unknown }
    }
  } = getSnapshot(view)
  expect(snap.init).toBeUndefined()
  expect(snap.spreadsheetView.init).toBeUndefined()
  expect(snap.spreadsheetView.importWizard.cachedFileLocation).toBeDefined()
}, 40000)
