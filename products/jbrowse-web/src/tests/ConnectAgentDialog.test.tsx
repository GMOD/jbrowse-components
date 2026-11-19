import { commandLineAgentRoute, inPageAgentRoute } from '@jbrowse/app-core'
import { fireEvent } from '@testing-library/react'

import packageJSON from '../../package.json' with { type: 'json' }
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
  const commandLinePrompt = commandLineAgentRoute(packageJSON.version)
    .snippets[0]!.text
  const { findByText, findAllByText, findByRole } = await createView(
    volvoxConfigWithTracks([]),
  )

  fireEvent.click(await findByText('Help', {}, delay))
  fireEvent.click(await findByText('Connect an AI agent...', {}, delay))
  fireEvent.click(await findByRole('button', { name: 'Copy' }, delay))
  await findByRole('button', { name: 'Copied' }, delay)
  expect(writeText).toHaveBeenLastCalledWith(
    inPageAgentRoute().snippets[0]!.text,
  )

  fireEvent.click(await findByRole('tab', { name: 'Command line' }, delay))
  fireEvent.click(await findByRole('button', { name: 'Copy' }, delay))
  await findByRole('button', { name: 'Copied' }, delay)
  expect(writeText).toHaveBeenLastCalledWith(commandLinePrompt)
  expect(commandLinePrompt).toContain('.claude/skills')
  expect(commandLinePrompt).toContain(
    `npx @jbrowse/cli@${packageJSON.version} validate`,
  )
  await findAllByText('ctgA', {}, delay)
}, 30000)
