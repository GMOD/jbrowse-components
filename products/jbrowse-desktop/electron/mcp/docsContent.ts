// Raw documentation served through the `docs` tool, bundled as text at build
// time (esbuild `.md` loader) so the packaged app and the standalone stdio
// server both carry it. Loaded lazily from stdioServer so jest, which has no
// .md loader, never resolves these imports.
import hostedData from '../../../../website/docs/agents_hosted_data.md'
import liveModelGuide from '../../../../website/docs/agents_live_model.md'
import recipes from '../../../../website/docs/agents_recipes.md'
import automating from '../../../../website/docs/automating.md'
import plots from '../../../../website/docs/config_guides/mark_display.md'
import urlparams from '../../../../website/docs/urlparams.md'
import { DOC_TOPICS, OMITTED_SECTIONS, SPLIT_TOPICS } from './docLimits.ts'
import { searchDocs } from './docSearch.ts'
import { readDocSection } from './docSections.ts'
import typePages from './docs/typeDocs.generated.json'
import { lookupTypeDoc, typeIndex } from './typeDocs.ts'

import type { DocTopic } from './docLimits.ts'
import type { BridgeToolResult } from './stdioServer.ts'

// The text for each topic DOC_TOPICS declares. esbuild inlines a static `.md`
// import and nothing else, so the imports stay here and the keys are what holds
// the two halves together: the annotation fails the build on a topic with no
// text, and on text belonging to no topic.
const TOPIC_TEXT: Record<DocTopic, string> = {
  'live-model': liveModelGuide,
  recipes,
  'hosted-data': hostedData,
  'session-spec': urlparams,
  plots,
  automating,
}

// Every markdown topic and every generated type page, as one flat list for the
// search. The type pages carry their name separately because a name match is
// what an agent usually means.
function searchableDocs() {
  return [
    ...Object.entries(TOPIC_TEXT).map(([topic, text]) => ({ topic, text })),
    ...(['models', 'configs'] as const).flatMap(kind =>
      Object.entries(typePages[kind]).map(([name, page]) => ({
        topic: `${kind === 'models' ? 'model' : 'config'}:${name}`,
        text: page.text,
        name,
      })),
    ),
  ]
}

export function docsToolResult(
  args: Record<string, unknown>,
): BridgeToolResult {
  const topic = typeof args.topic === 'string' ? args.topic : ''
  const section = typeof args.section === 'string' ? args.section : ''
  const search = typeof args.search === 'string' ? args.search : ''
  if (search) {
    return searchDocs(searchableDocs(), search)
  }
  if (Object.hasOwn(TOPIC_TEXT, topic)) {
    return readDocSection(TOPIC_TEXT[topic as DocTopic], section, {
      splitAt: SPLIT_TOPICS[topic],
      omit: OMITTED_SECTIONS[topic],
    })
  }
  if (topic === 'types') {
    return { text: typeIndex(typePages) }
  }
  const typed = topic ? lookupTypeDoc(typePages, topic) : undefined
  if (typed) {
    return 'text' in typed
      ? readDocSection(typed.text, section, { members: true })
      : typed
  }
  const listing = [
    ...Object.entries(DOC_TOPICS).map(([name, t]) => `- ${name}: ${t.summary}`),
    '- model:<Name> / config:<Name>: one type\'s runtime API (actions, getters, properties) or config slots, generated from the running version; "types" lists every name',
  ].join('\n')
  return topic
    ? {
        error: `No topic "${topic}". Available:\n${listing}\n\nOr pass search to look inside every page at once.`,
      }
    : {
        text: `Pass topic to read one of:\n${listing}\n\nOr pass search to look inside every page at once (e.g. search "color").`,
      }
}
