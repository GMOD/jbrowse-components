import { lazy } from 'react'

export const ConnectAgentDialog = lazy(() => import('./ConnectAgentDialog.tsx'))
export {
  AGENT_DOCS_URL,
  AGENT_SKILLS_URL,
  commandLineAgentRoute,
  inPageAgentRoute,
} from './agentRoutes.tsx'
export type { AgentRoute, AgentSnippet } from './agentRoutes.tsx'
