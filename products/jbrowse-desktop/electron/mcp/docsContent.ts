// Raw documentation served through the `docs` tool, bundled as text at build
// time (esbuild `.md` loader) so the packaged app and the standalone stdio
// server both carry it. Loaded lazily from stdioServer so jest, which has no
// .md loader, never resolves these imports.
import automating from '../../../../website/docs/automating.md'
import urlparams from '../../../../website/docs/urlparams.md'
import { readDocSection } from './docSections.ts'
import liveModelGuide from './docs/live-model-guide.md'
import typePages from './docs/typeDocs.generated.json'
import { lookupTypeDoc, typeIndex } from './typeDocs.ts'

import type { BridgeToolResult } from './stdioServer.ts'

const TOPICS: Record<string, { summary: string; text: string }> = {
  'live-model': {
    summary:
      'Driving the live session from run_javascript: model orientation, MST rules, direct adapter data access, waiting on renders',
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
  const section = typeof args.section === 'string' ? args.section : ''
  const entry = TOPICS[topic]
  if (entry) {
    return readDocSection(entry.text, section)
  }
  if (topic === 'types') {
    return { text: typeIndex(typePages) }
  }
  const typed = lookupTypeDoc(typePages, topic)
  if (typed) {
    return 'text' in typed ? readDocSection(typed.text, section) : typed
  }
  const listing = [
    ...Object.entries(TOPICS).map(([name, t]) => `- ${name}: ${t.summary}`),
    '- model:<Name> / config:<Name>: one type\'s runtime API (actions, getters, properties) or config slots, generated from the running version; "types" lists every name',
  ].join('\n')
  return topic
    ? { error: `No topic "${topic}". Available:\n${listing}` }
    : { text: `Pass topic to read one of:\n${listing}` }
}
