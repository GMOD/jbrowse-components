import { waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'
import { configure } from 'mobx'

import { handleRequest } from './generateReadBuffer'
import { getPluginManager, setup } from './util'

setup()

console.warn = jest.fn()
console.error = jest.fn()

configure({ disableErrorBoundaries: true })

const getFile = (url: string) => {
  const cleanUrl = url.replace(/http:\/\/localhost\//, '')
  const filePath = cleanUrl.startsWith('test_data')
    ? cleanUrl
    : `test_data/volvox/${cleanUrl}`
  return new LocalFile(require.resolve(`../../${filePath}`))
}

jest.mock('../makeWorkerInstance', () => () => {})

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

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
