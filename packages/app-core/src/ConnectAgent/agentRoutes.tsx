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

const FINISH_THE_PROMPT =
  'Paste the prompt into the agent and finish its last line with your goal.'

export function inPageAgentRoute(): AgentRoute {
  return {
    label: 'In this page',
    snippets: [
      {
        label: 'Prompt',
        text: 'This tab is JBrowse Web. Drive it through window.jb: wait for it to exist, read jb.help, then orient with jb.sessionSummary(). My goal: ',
      },
    ],
    about: (
      <>
        An agent that can run JavaScript in this tab drives it through{' '}
        <code>window.jb</code>: it builds views, adds tracks, reads feature data
        and checks what drew. That can be a browser extension such as{' '}
        <Link
          href="https://claude.com/chrome"
          target="_blank"
          rel="noopener noreferrer"
        >
          Claude in Chrome
        </Link>
        , or a coding agent connected to Chrome through{' '}
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
        . Files it adds have to be URLs this page can fetch. {FINISH_THE_PROMPT}
      </>
    ),
  }
}

export function commandLineAgentRoute(version: string): AgentRoute {
  return {
    label: 'Command line',
    snippets: [
      {
        label: 'Prompt',
        text: `Follow the jbrowse-authoring, jbrowse-hosted-data and jbrowse-capture skills at ${AGENT_SKILLS_URL}. From the command line, build the view (name a hosted genome with --genome, or write a config for your own data and check it with npx @jbrowse/cli@${version} validate), render it with npx @jbrowse/img@${version} or npx @jbrowse/capture@${version}, and look at the image to confirm every track drew. My goal: `,
      },
    ],
    about: (
      <>
        An agent with a shell, such as Claude Code, Codex CLI or Gemini CLI,
        needs no JBrowse window open. It opens a hosted genome or writes a
        config for your data, renders it to an image with{' '}
        <code>@jbrowse/img</code>, or with <code>@jbrowse/capture</code> when it
        needs the full app, and reads the image back to check its work. The
        prompt points it at the{' '}
        <Link href={AGENT_SKILLS_URL} target="_blank" rel="noopener noreferrer">
          JBrowse agent skills
        </Link>
        . {FINISH_THE_PROMPT}
      </>
    ),
  }
}
