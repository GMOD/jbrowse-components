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

utilizeFetchMockForTest(volvoxGetFile)

async function createSpreadsheetViewWithInit(spec: {
  assembly: string
  uri: string
  fileType?: string
}) {
  const { pluginManager, rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SpreadsheetView', spec)
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('SpreadsheetView initializes from a launch key for vcf.gz', async () => {
  const { view } = await createSpreadsheetViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.filtered.vcf.gz',
  })

  await waitFor(
    () => {
      expect(view.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )

  expect(view.spreadsheet?.assemblyName).toBe('volvox')
  expect(view.init).toBeUndefined()
}, 40000)

test('SpreadsheetView initializes from a launch key for bed.gz', async () => {
  const { view } = await createSpreadsheetViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox-bed12.bed.gz',
  })

  await waitFor(
    () => {
      expect(view.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )

  expect(view.spreadsheet?.assemblyName).toBe('volvox')
  expect(view.init).toBeUndefined()
}, 40000)

test('SpreadsheetView initializes with explicit fileType', async () => {
  const { view } = await createSpreadsheetViewWithInit({
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.filtered.vcf.gz',
    fileType: 'VCF',
  })

  await waitFor(
    () => {
      expect(view.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )

  expect(view.spreadsheet?.assemblyName).toBe('volvox')
  expect(view.init).toBeUndefined()
}, 40000)

test('SpreadsheetView with no launch keys shows import form', () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SpreadsheetView', {})

  expect(view.spreadsheet).toBeUndefined()
  expect(view.init).toBeUndefined()
}, 40000)

// Regression: the reaction clears init synchronously, so the cached file
// location is the reconstruction source. It must be persisted synchronously
// (not just the volatile fileSource) so a snapshot taken before the async load
// finishes can still reload the file instead of stranding on the import form.
test('snapshot persists cached file location synchronously', async () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SpreadsheetView', {
    assembly: 'volvox',
    uri: 'test_data/volvox/volvox.filtered.vcf.gz',
  })

  const snap: {
    launch?: unknown
    importWizard: { cachedFileLocation?: unknown }
  } = getSnapshot(view)
  expect(snap.launch).toBeUndefined()
  expect(snap.importWizard.cachedFileLocation).toBeDefined()

  // The snapshot assertions above intentionally run before the async load
  // finishes; let it settle before the test ends so its resolution doesn't
  // throw "require a file after the Jest environment has been torn down"
  // from the import wizard's dynamic import.
  await waitFor(
    () => {
      expect(view.spreadsheet).toBeDefined()
    },
    { timeout: 30000 },
  )
}, 40000)
