import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createView, doBeforeEach, hts, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

async function openSaveTrackDataDialog(
  user: ReturnType<typeof userEvent.setup>,
  trackId: string,
) {
  await user.click(await screen.findByTestId(hts(trackId), ...opts))
  await screen.findAllByTestId(/prerendered_canvas/, ...opts)
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Save track data'))
  await screen.findByText('Save track data', ...opts)
}

test('save track data for VCF track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.05, 5000)

  await openSaveTrackDataDialog(user, 'volvox_filtered_vcf')

  await waitFor(
    async () => {
      const textField = await screen.findByRole('textbox', { name: /region/i })
      expect(textField).toHaveValue()
    },
    { timeout: 30000 },
  )

  await user.click(await screen.findByText('Close'))
}, 60000)

test('save track data for BAM track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.05, 5000)

  await openSaveTrackDataDialog(user, 'volvox_bam')

  await waitFor(
    async () => {
      const textField = await screen.findByRole('textbox', { name: /region/i })
      expect(textField).toHaveValue()
    },
    { timeout: 30000 },
  )

  await user.click(await screen.findByText('Close'))
}, 60000)

test('save track data for CRAM track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.05, 5000)

  await openSaveTrackDataDialog(user, 'volvox_cram')

  await waitFor(
    async () => {
      const textField = await screen.findByRole('textbox', { name: /region/i })
      expect(textField).toHaveValue()
    },
    { timeout: 30000 },
  )

  await user.click(await screen.findByText('Close'))
}, 60000)

test('save track data for GFF track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.05, 5000)

  await openSaveTrackDataDialog(user, 'gff3tabix_genes')

  await waitFor(
    async () => {
      const textField = await screen.findByRole('textbox', { name: /region/i })
      expect(textField).toHaveValue()
    },
    { timeout: 30000 },
  )

  await user.click(await screen.findByText('Close'))
}, 60000)

test('save track data for BED track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.05, 5000)

  await openSaveTrackDataDialog(user, 'bedtabix_genes')

  await waitFor(
    async () => {
      const textField = await screen.findByRole('textbox', { name: /region/i })
      expect(textField).toHaveValue()
    },
    { timeout: 30000 },
  )

  await user.click(await screen.findByText('Close'))
}, 60000)

test('save track data for BigWig track', async () => {
  const user = userEvent.setup()
  const { view } = await createView()
  view.setNewView(0.05, 5000)

  await openSaveTrackDataDialog(user, 'volvox_microarray')

  await waitFor(
    async () => {
      const textField = await screen.findByRole('textbox', { name: /region/i })
      expect(textField).toHaveValue()
    },
    { timeout: 30000 },
  )

  await user.click(await screen.findByText('Close'))
}, 60000)
