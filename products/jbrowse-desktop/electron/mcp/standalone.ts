import packageJSON from '../../package.json' with { type: 'json' }
import { defaultSocketPath } from './socketPath.ts'
import { runMcpStdioServer } from './stdioServer.ts'

// Plain-node entry for the MCP stdio server (build/mcpServer.js), for MCP
// clients configured to run `node` rather than the packaged app with --mcp.
// Both connect to the one socket the running app serves.
runMcpStdioServer({
  socketPath: defaultSocketPath(),
  version: packageJSON.version,
  onExit: () => {
    process.exit(0)
  },
})
