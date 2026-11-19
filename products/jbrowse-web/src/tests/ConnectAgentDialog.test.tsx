import { fireEvent } from '@testing-library/react'

import packageJSON from '../../package.json' with { type: 'json' }
import { routes } from '../components/ConnectAgentDialog.tsx'
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

test('Help copies the in-page prompt, and the command-line one from its tab', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined)
  Object.assign(navigator, { clipboard: { writeText } })
  Object.defineProperty(window, 'isSecureContext', { value: true })
  const [page, commandLine] = routes
  const { findByText, findAllByText, findByRole } = await createView(
    volvoxConfigWithTracks([]),
  )

  fireEvent.click(await findByText('Help', {}, delay))
  fireEvent.click(await findByText('Connect an AI agent...', {}, delay))
  fireEvent.click(await findByText('Copy prompt', {}, delay))
  await findAllByText('Copied prompt to clipboard', {}, delay)
  expect(writeText).toHaveBeenLastCalledWith(page!.prompt)

  fireEvent.click(await findByRole('tab', { name: 'Command line' }, delay))
  fireEvent.click(await findByText('Copy prompt', {}, delay))
  await findAllByText('Copied prompt to clipboard', {}, delay)
  expect(writeText).toHaveBeenLastCalledWith(commandLine!.prompt)
  expect(commandLine!.prompt).toContain('.claude/skills')
  expect(commandLine!.prompt).toContain(
    `npx @jbrowse/cli@${packageJSON.version} validate`,
  )
  await findAllByText('ctgA', {}, delay)
}, 30000)
