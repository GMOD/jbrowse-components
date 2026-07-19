import type { LayoutNode, ViewSpec } from './types.ts'

// Reads a JBrowse Web URL (the kind the website's figure links and the share
// button hand out) back into the config it loads and the session spec it
// encodes. jbrowse-web parses these out of its own address bar; this exists so
// anything *else* holding such a URL — Desktop opening a pasted link, a future
// `jbrowse://` protocol handler — resolves it identically instead of
// reimplementing the query format.
//
// Only `session=spec-…` is understood. A `share-`/`encoded-`/`local-` session
// needs jbrowse-web's session store or its encryption key, neither of which
// exists outside the browser that made it.

export interface ParsedSessionSpec {
  // the `config=` value: an absolute URL, or a path relative to the JBrowse Web
  // instance the link points at (resolved against it here, so the caller gets
  // something fetchable)
  configUrl?: string
  spec: {
    views: ViewSpec[]
    sessionAssemblies?: Record<string, unknown>[]
    sessionTracks?: Record<string, unknown>[]
    layout?: LayoutNode
  }
  sessionName?: string
}

// jbrowse-web keeps its URL params in the hash fragment XOR the query string
// (the inline `encoded-`/`json-`/`spec-` sessions live in the hash to dodge the
// server request-line limit; short `share-` links stay in the query). Read from
// whichever the link uses so a pasted hash-form link parses the same as a
// query-form one, instead of tripping the "no session in it" error below.
//
// This MUST stay identical to jbrowse-web's own reader (`useQueryParam.ts`
// `paramLocation`: `hash.includes('=') ? hash : search`) — that module's whole
// point, and this file's, is that a URL resolves the same everywhere. The XOR is
// a documented invariant its producers (`buildShareUrl`) guarantee, so a
// both-present link is a non-case; don't "harden" this into a merge that would
// diverge from the canonical parser.
function linkParams(url: URL): URLSearchParams {
  const hash = url.hash.slice(1)
  return new URLSearchParams(hash.includes('=') ? hash : url.search)
}

export function parseSessionSpecUrl(input: string): ParsedSessionSpec {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new Error(`Not a URL: ${input}`)
  }

  const params = linkParams(url)
  const session = params.get('session')
  if (!session) {
    throw new Error(
      'That link has no session in it. Copy a JBrowse Web link that contains "&session=spec-...".',
    )
  }
  if (!session.startsWith('spec-')) {
    const kind = /^(share|encoded|local|json)-/.exec(session)?.[1]
    throw new Error(
      kind
        ? `This is a "${kind}" session link, which only the JBrowse Web instance that created it can open. Session-spec links (&session=spec-...) work here.`
        : 'Unrecognized session in that link; only session-spec links (&session=spec-...) can be opened here.',
    )
  }

  let spec: ParsedSessionSpec['spec']
  try {
    spec = JSON.parse(
      session.slice('spec-'.length),
    ) as ParsedSessionSpec['spec']
  } catch (e) {
    throw new Error(`The session spec in that link isn't valid JSON: ${e}`, {
      cause: e,
    })
  }
  // `views: []` is legitimate and deliberate — it opens a session showing the
  // import form (several docs figures are exactly that). Only a spec with no
  // views *key* is malformed, and would otherwise build an empty session that
  // reads as a silent failure.
  if (!Array.isArray(spec.views)) {
    throw new Error(
      'The session spec in that link has no "views" list, so there is nothing to open.',
    )
  }

  const config = params.get('config')
  return {
    // a relative config (e.g. `test_data/volvox/config.json`) is served by the
    // instance the link points at, so resolve it there rather than handing back
    // a path nothing outside that instance could fetch
    configUrl: config ? new URL(config, url.href).href : undefined,
    spec,
    sessionName: params.get('sessionName') ?? undefined,
  }
}
