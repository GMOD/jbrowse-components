// Raw documentation served through the `docs` tool, bundled as text at build
// time (esbuild `.md` loader) so the packaged app and the standalone stdio
// server both carry it. Loaded lazily from stdioServer so jest, which has no
// .md loader, never resolves these imports.
import automating from '../../../../website/docs/automating.md'
import urlparams from '../../../../website/docs/urlparams.md'
import liveModelGuide from './docs/live-model-guide.md'

import type { BridgeToolResult } from './stdioServer.ts'

const TOPICS: Record<string, { summary: string; text: string }> = {
  'live-model': {
    summary:
      'Driving the live session from evaluate: model orientation, MST rules, direct adapter data access, waiting on renders',
    text: liveModelGuide,
  },
  'session-spec': {
    summary:
      'Full session spec / URL params reference: every view type and its launch keys, track entry fields, layout, workspaces',
    text: urlparams,
  },
  automating: {
    summary:
      'Overview of automating JBrowse: launch settings, the four front ends that accept them',
    text: automating,
  },
}

export function docsToolResult(
  args: Record<string, unknown>,
): BridgeToolResult {
  const topic = typeof args.topic === 'string' ? args.topic : ''
  const entry = TOPICS[topic]
  if (entry) {
    return { text: entry.text }
  }
  const listing = Object.entries(TOPICS)
    .map(([name, t]) => `- ${name}: ${t.summary}`)
    .join('\n')
  return topic
    ? { error: `No topic "${topic}". Available:\n${listing}` }
    : { text: `Pass topic to read one of:\n${listing}` }
}
