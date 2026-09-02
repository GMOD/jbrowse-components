// The text a person pastes to connect an MCP client to this install. The
// website quotes three platform-specific binary paths and a fourth form for a
// source checkout; the app knows which one it is.
export function mcpCommand({
  execPath,
  packaged,
  mcpServerScript,
}: {
  execPath: string
  packaged: boolean
  mcpServerScript: string
}) {
  return packaged
    ? { command: execPath, args: ['--mcp'] }
    : { command: 'node', args: [mcpServerScript] }
}

export function mcpClientConfigJson(command: ReturnType<typeof mcpCommand>) {
  return JSON.stringify({ mcpServers: { jbrowse: command } }, null, 2)
}

export function claudeCodeAddCommand(command: ReturnType<typeof mcpCommand>) {
  return `claude mcp add jbrowse -s user -- ${[command.command, ...command.args]
    .map(part => JSON.stringify(part))
    .join(' ')}`
}
