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

async function createSpreadsheetViewWithInit(init: {
  assembly: string
  uri: string
  fileType?: string
}) {
  const { pluginManager, rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SpreadsheetView', { init })
  view.setWidth(800)

  return { view, session, rootModel, pluginManager }
}

test('SpreadsheetView initializes with init property for vcf.gz', async () => {
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

test('SpreadsheetView initializes with init property for bed.gz', async () => {
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

test('SpreadsheetView without init shows import form', () => {
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
test('snapshot persists cached file location synchronously', () => {
  const { rootModel } = getPluginManager()
  rootModel.setDefaultSession()
  const session = rootModel.session!

  const view = session.addView('SpreadsheetView', {
    init: {
      assembly: 'volvox',
      uri: 'test_data/volvox/volvox.filtered.vcf.gz',
    },
  })

  expect(getSnapshot(view).init).toBeUndefined()
  expect(getSnapshot(view).importWizard.cachedFileLocation).toBeDefined()
}, 40000)
