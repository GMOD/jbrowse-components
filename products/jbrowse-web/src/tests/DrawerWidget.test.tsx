import '@testing-library/jest-dom'

import { fireEvent, getByRole } from '@testing-library/react'
import { createView, doBeforeEach, hts } from './util'
import userEvent from '@testing-library/user-event'

const delay = { timeout: 15000 }

beforeEach(() => {
  doBeforeEach()
})

test('opens feature detail from left click', async () => {
  const { view, findByTestId, findAllByTestId } = await createView()
  view.setNewView(0.05, 5000)
  const user = userEvent.setup()
  await user.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))

  view.tracks[0].displays[0].setFeatureIdUnderMouse('test-vcf-604453')
  await user.click((await findAllByTestId('test-vcf-604453', {}, delay))[0])
  expect(
    await findByTestId('variant-side-drawer', {}, delay),
  ).toBeInTheDocument()
}, 20000)

test('open feature detail from right click', async () => {
  const { view, findByTestId, findAllByTestId, findByText } = await createView()
  view.setNewView(0.05, 5000)
  const user = userEvent.setup()
  await user.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  view.tracks[0].displays[0].setFeatureIdUnderMouse('test-vcf-604453')

  fireEvent.contextMenu(
    (await findAllByTestId('test-vcf-604453', {}, delay))[0],
  )
  await user.click(await findByText('Open feature details'))
  expect(
    await findByTestId('variant-side-drawer', {}, delay),
  ).toBeInTheDocument()
}, 20000)

test('widget drawer navigation', async () => {
  const { session, findByTestId, findByText } = await createView()
  const user = userEvent.setup()
  await user.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  await user.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  await user.click(await findByText('Settings'))
  await findByTestId('configEditor', {}, delay)
  // shows up when there active widgets
  await user.click(
    getByRole(await findByTestId('widget-drawer-selects'), 'combobox'),
  )
  await user.click(
    await findByTestId(
      'widget-drawer-selects-item-HierarchicalTrackSelectorWidget',
    ),
  )
  await findByTestId('hierarchical_track_selector')

  // test minimize and maximize widget drawer
  // @ts-expect-error
  expect(session.minimized).toBeFalsy()

  await findByTestId('drawer-minimize')
  await user.click(await findByTestId('drawer-minimize'))
  // @ts-expect-error
  expect(session.minimized).toBeTruthy()

  await user.click(await findByTestId('drawer-maximize'))
  // @ts-expect-error
  expect(session.minimized).toBeFalsy()

  // test deleting widget from select dropdown using trash icon
  // @ts-expect-error
  expect(session.activeWidgets.size).toEqual(2)
  await user.click(
    getByRole(await findByTestId('widget-drawer-selects'), 'combobox'),
  )
  await user.click(
    await findByTestId('ConfigurationEditorWidget-drawer-delete'),
  )
  // @ts-expect-error
  expect(session.activeWidgets.size).toEqual(1)
}, 20000)
