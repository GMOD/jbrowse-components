import { commandLineAgentRoute } from '@jbrowse/app-core'

import type { ConnectAgentSetup } from '../../electron/ipc/channelTypes.ts'
import type { AgentRoute } from '@jbrowse/app-core'

function mcpAgentRoute(setup: ConnectAgentSetup): AgentRoute {
  return setup.disabledBy === undefined
    ? {
        label: 'MCP server',
        warning: setup.notServing
          ? `${setup.notServing} Fix that and relaunch JBrowse Desktop; until then the setup below reaches nothing here.`
          : undefined,
        about: (
          <>
            Leave JBrowse Desktop running and point an MCP client at it, such as
            Claude Desktop, Claude Code, Codex or Cursor. The client then reads
            and changes the open session: it builds views, adds tracks, reads
            feature data and takes screenshots. Most clients read the config
            below (Claude Desktop: Settings, Developer, Edit Config); any other
            takes the same command and argument. Any code the agent runs has the
            same access to this computer as the app. Set{' '}
            <code>JBROWSE_DISABLE_MCP=1</code> to turn the server off.
          </>
        ),
        snippets: [
          { label: 'MCP client config', text: setup.clientConfigJson },
          { label: 'Claude Code command', text: setup.claudeCodeCommand },
        ],
      }
    : {
        label: 'MCP server',
        about: (
          <>
            The MCP server is turned off: <code>JBROWSE_DISABLE_MCP</code> is
            set to <code>{setup.disabledBy}</code> in this environment. Unset it
            (or set it to 0) and relaunch JBrowse Desktop to let an MCP client
            drive it.
          </>
        ),
        snippets: [],
      }
}

export function desktopAgentRoutes(setup: ConnectAgentSetup) {
  return [mcpAgentRoute(setup), commandLineAgentRoute(setup.version)]
}
