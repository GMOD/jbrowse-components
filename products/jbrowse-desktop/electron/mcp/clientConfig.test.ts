import {
  claudeCodeAddCommand,
  mcpClientConfigJson,
  mcpCommand,
} from './clientConfig.ts'

const packaged = mcpCommand({
  execPath: '/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2',
  packaged: true,
  mcpServerScript: '/checkout/build/mcpServer.js',
})
const checkout = mcpCommand({
  execPath: '/checkout/node_modules/electron/dist/Electron',
  packaged: false,
  mcpServerScript: '/checkout/build/mcpServer.js',
})

test('a packaged app is its own binary with --mcp', () => {
  expect(JSON.parse(mcpClientConfigJson(packaged))).toEqual({
    mcpServers: {
      jbrowse: {
        command: '/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2',
        args: ['--mcp'],
      },
    },
  })
})

test('a source checkout points at the built stdio server, not the electron binary', () => {
  expect(checkout).toEqual({
    command: 'node',
    args: ['/checkout/build/mcpServer.js'],
  })
})

test('the Claude Code command quotes a path with spaces', () => {
  expect(claudeCodeAddCommand(packaged)).toBe(
    'claude mcp add jbrowse -s user -- "/Applications/JBrowse 2.app/Contents/MacOS/JBrowse 2" "--mcp"',
  )
})
