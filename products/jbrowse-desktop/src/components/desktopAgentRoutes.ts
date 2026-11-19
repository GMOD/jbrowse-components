import { commandLineAgentRoute } from '@jbrowse/app-core'

import type { ConnectAgentSetup } from '../../electron/ipc/channelTypes.ts'
import type { AgentRoute } from '@jbrowse/app-core'

function mcpAgentRoute(setup: ConnectAgentSetup): AgentRoute {
  return setup.disabledBy === undefined
    ? {
        label: 'MCP',
        warning: setup.notServing
          ? `${setup.notServing} Relaunch JBrowse Desktop once that is fixed.`
          : undefined,
        about:
          'For an MCP client such as Claude Desktop, Claude Code or Cursor. Keep JBrowse Desktop open while it works.',
        snippets: [
          { label: 'MCP config', text: setup.clientConfigJson },
          { label: 'Claude Code command', text: setup.claudeCodeCommand },
        ],
      }
    : {
        label: 'MCP',
        about: `The MCP server is off because JBROWSE_DISABLE_MCP=${setup.disabledBy}. Unset it and relaunch.`,
        snippets: [],
      }
}

export function desktopAgentRoutes(setup: ConnectAgentSetup) {
  return [mcpAgentRoute(setup), commandLineAgentRoute(setup.version)]
}
