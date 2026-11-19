import { fireEvent } from '@testing-library/react'

import { STARTER_PROMPT } from '../components/ConnectAgentDialog.tsx'
import {
  createView,
  doBeforeEach,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }

test('Help offers the Claude in Chrome route and copies its starter prompt', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  Object.defineProperty(window, 'isSecureContext', { value: true })
  const { findByText, findAllByText } = await createView(
    volvoxConfigWithTracks([]),
  )

  fireEvent.click(await findByText('Help', {}, delay))
  fireEvent.click(await findByText('Connect an AI agent...', {}, delay))
  await findByText(/Claude in Chrome side panel/, {}, delay)
  fireEvent.click(await findByText('Copy starter prompt', {}, delay))

  await findByText('Copied starter prompt to clipboard', {}, delay)
  expect(writeText).toHaveBeenCalledWith(STARTER_PROMPT)
  await findAllByText('ctgA', {}, delay)
}, 30000)
