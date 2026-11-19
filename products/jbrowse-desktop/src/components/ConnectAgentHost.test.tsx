import { act, fireEvent, render } from '@testing-library/react'

import { onIpc } from '../ipc.ts'
import ConnectAgentHost from './ConnectAgentHost.tsx'

import type { ConnectAgentSetup } from '../../electron/ipc/channelTypes.ts'

jest.mock('../ipc.ts', () => ({ onIpc: jest.fn() }))

const mockOnIpc = jest.mocked(onIpc)

const setup: ConnectAgentSetup = {
  version: '5.0.0-test',
  clientConfigJson: '{"mcpServers":{"jbrowse":{"command":"/opt/jb2"}}}',
  claudeCodeCommand: 'claude mcp add jbrowse -s user -- "/opt/jb2" "--mcp"',
}

function renderHost() {
  let push!: (s: ConnectAgentSetup) => void
  mockOnIpc.mockImplementation((channel, listener) => {
    expect(channel).toBe('connectAgentSetup')
    push = listener
    return () => {}
  })
  const utils = render(<ConnectAgentHost />)
  return {
    ...utils,
    push: (s: ConnectAgentSetup) => {
      act(() => {
        push(s)
      })
    },
  }
}

beforeEach(() => {
  jest.resetAllMocks()
})

test('a push opens the dialog on the MCP tab with this install, and the command-line tab pins its version', async () => {
  const { push, findByText, findByRole, queryByText, getByDisplayValue } =
    renderHost()
  expect(queryByText('Connect an AI agent')).toBeNull()

  push(setup)
  await findByText('Connect an AI agent')
  getByDisplayValue(setup.clientConfigJson)
  getByDisplayValue(setup.claudeCodeCommand)

  fireEvent.click(await findByRole('tab', { name: 'Command line' }))
  await findByText(/npx @jbrowse\/cli@5\.0\.0-test validate/)

  fireEvent.click(await findByRole('button', { name: 'Close' }))
  expect(queryByText('Connect an AI agent')).toBeNull()
})

test('a server that did not start leads with why, and a disabled one offers no config', async () => {
  const { push, findByText, queryByDisplayValue, getByRole } = renderHost()
  push({ ...setup, notServing: 'Another JBrowse Desktop is serving /x.' })
  await findByText(/Another JBrowse Desktop is serving \/x\. Fix that/)

  fireEvent.click(getByRole('button', { name: 'Close' }))
  push({ ...setup, disabledBy: '1' })
  await findByText(/The MCP server is turned off/)
  expect(queryByDisplayValue(setup.clientConfigJson)).toBeNull()
})
