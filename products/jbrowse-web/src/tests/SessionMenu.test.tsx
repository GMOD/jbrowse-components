import '@testing-library/jest-dom'

import { fireEvent, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, volvoxConfigWithTracks } from './util.tsx'

// nothing here opens or reads a track: these are File-menu items - see
// volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_filtered_vcf'])

beforeEach(() => {
  doBeforeEach()
  jest.spyOn(console, 'warn').mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('duplicate session creates a new session with different id', async () => {
  const { rootModel, findByText } = await createView(config)
  const originalSessionId = rootModel.session!.id

  // Open File menu and click Duplicate session
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Duplicate session'))

  await waitFor(() => {
    expect(rootModel.session!.id).not.toBe(originalSessionId)
  })
  expect(rootModel.session!.name).toMatch(/ \(copy\)$/)
}, 30000)

test('sessions opens the session manager widget', async () => {
  const { rootModel, findByText } = await createView(config)

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Sessions...'))

  await waitFor(
    () => {
      // @ts-expect-error
      const widgets = [...rootModel.session!.activeWidgets.values()]
      expect(widgets.some(w => w.type === 'SessionManager')).toBe(true)
    },
    { timeout: 10000 },
  )
}, 30000)

test('import session menu item opens widget', async () => {
  const { rootModel, findByText } = await createView(config)

  // Open File menu and click Import session
  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Import session...'))

  await waitFor(
    () => {
      // @ts-expect-error
      const widgets = [...rootModel.session!.activeWidgets.values()]
      expect(widgets.some(w => w.type === 'ImportSessionWidget')).toBe(true)
    },
    { timeout: 10000 },
  )
}, 30000)
