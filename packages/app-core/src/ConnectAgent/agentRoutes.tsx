import { Link } from '@mui/material'

export interface AgentSnippet {
  label: string
  text: string
}

export interface AgentRoute {
  label: string
  about: React.ReactNode
  warning?: string
  snippets: AgentSnippet[]
}

export const AGENT_SKILLS_URL =
  'https://github.com/GMOD/jbrowse-components/tree/main/.claude/skills'

export const AGENT_DOCS_URL = 'https://jbrowse.org/jb2/docs/agents/'

const PROMPT_LABEL = 'Prompt: add your goal at the end'

export function inPageAgentRoute(): AgentRoute {
  return {
    label: 'This page',
    snippets: [
      {
        label: PROMPT_LABEL,
        text: 'This tab is JBrowse Web. Drive it through window.jb: wait for it to exist, read jb.help, then orient with jb.sessionSummary(). My goal: ',
      },
    ],
    about: (
      <>
        For an agent that can run JavaScript in this page, such as{' '}
        <Link
          href="https://claude.com/chrome"
          target="_blank"
          rel="noopener noreferrer"
        >
          Claude in Chrome
        </Link>
        ,{' '}
        <Link
          href="https://github.com/ChromeDevTools/chrome-devtools-mcp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Chrome DevTools MCP
        </Link>{' '}
        or{' '}
        <Link
          href="https://github.com/microsoft/playwright-mcp"
          target="_blank"
          rel="noopener noreferrer"
        >
          Playwright MCP
        </Link>
        .
      </>
    ),
  }
}

export function commandLineAgentRoute(version: string): AgentRoute {
  return {
    label: 'Command line',
    snippets: [
      {
        label: PROMPT_LABEL,
        text: `Follow the jbrowse-authoring, jbrowse-hosted-data and jbrowse-capture skills at ${AGENT_SKILLS_URL}. From the command line, build the view (name a hosted genome with --genome, or write a config for your own data and check it with npx @jbrowse/cli@${version} validate), render it with npx @jbrowse/img@${version} or npx @jbrowse/capture@${version}, and look at the image to confirm every track drew. My goal: `,
      },
    ],
    about:
      'For an agent with a shell, such as Claude Code, Codex CLI or Gemini CLI. It makes images without opening JBrowse.',
  }
}
