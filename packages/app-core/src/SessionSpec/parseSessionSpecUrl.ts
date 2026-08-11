import {
  buildLgvInitFromParams,
  hubConnectionSpec,
  readHubUrlParam,
} from './lgvUrlInit.ts'

import type { LgvUrlInit } from './lgvUrlInit.ts'
import type { LayoutNode, ViewSpec } from './types.ts'

// Reads a JBrowse Web URL (the kind the website's figure links and the share
// button hand out) back into the config it loads and the session spec it
// encodes. jbrowse-web parses these out of its own address bar; this exists so
// anything *else* holding such a URL — Desktop opening a pasted link, or a
// `jbrowse://` one — resolves it identically instead of reimplementing the query
// format.
//
// Three link forms produce a spec:
//
// - `session=spec-…`, which is one already.
// - `&hubURL=`, a track hub, which becomes a `sessionConnections` entry.
// - the `&loc=`/`&assembly=`/`&tracks=` shorthand JBrowse has read since JB1,
//   which jbrowse-web turns into a spec of a single LGV. It is the form the URL
//   params documentation teaches and the one people write by hand, and it used
//   to be reported here as "that link has no session in it" — about a link that
//   describes a perfectly openable view.
//
// A `share-`/`encoded-`/`local-` session is still not one of them: it needs
// jbrowse-web's session store or its encryption key, neither of which exists
// outside the browser that made it.

export interface ParsedSessionSpec {
  // the `config=` value: an absolute URL, or a path relative to the JBrowse Web
  // instance the link points at (resolved against it here, so the caller gets
  // something fetchable)
  configUrl?: string
  spec: {
    views: ViewSpec[]
    sessionAssemblies?: Record<string, unknown>[]
    sessionConnections?: Record<string, unknown>[]
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

// A `jbrowse://open?url=<web link>` wrapper carries a JBrowse Web url for
// Desktop's protocol handler to unwrap. Every page that offers an "Open in
// Desktop" button puts that link right next to the plain web one — the docs'
// figure dialogs, genomes.jbrowse.org — so the link someone copies and pastes
// into "Open JBrowse Web link..." is as often this as the url inside it. It
// parses as a perfectly good URL whose query has no `session`, which reported
// "that link has no session in it" about a link that does. Unwrap it instead.
//
// Restricted to http(s), and to a single unwrap, for the reason Desktop's own
// parser is (products/jbrowse-desktop/electron/launchTarget.ts, which gates the
// OS-delivered copy of this and cannot import from here — it is bundled into the
// Electron main process): the payload comes from whatever handed us the link.
function unwrapProtocolUrl(url: URL): URL {
  if (url.protocol !== 'jbrowse:') {
    return url
  }
  const wrapped = url.searchParams.get('url')
  if (!wrapped) {
    return url
  }
  try {
    const inner = new URL(wrapped)
    return inner.protocol === 'http:' || inner.protocol === 'https:'
      ? inner
      : url
  } catch {
    return url
  }
}

function resolveConfig(params: URLSearchParams, url: URL) {
  const config = params.get('config')
  return {
    // a relative config (e.g. `test_data/volvox/config.json`) is served by the
    // instance the link points at, so resolve it there rather than handing back
    // a path nothing outside that instance could fetch.
    //
    // `config=none` is jbrowse-web's "load no config at all" sentinel
    // (SessionLoader.fetchConfig), and the form a self-contained spec link has to
    // take — omitting `config` entirely makes web fall back to its own
    // config.json. Treated as no config here, not resolved, which would hand the
    // caller `<instance>/none` to fetch.
    configUrl:
      config && config !== 'none' ? new URL(config, url.href).href : undefined,
  }
}

/**
 * The spec a link with no `session=` describes — or the error explaining why it
 * describes none.
 *
 * The branches below are in jbrowse-web's own ranking (SessionLoader's
 * loadSessionByType), and have to be, because a link can carry several of these
 * at once and which one wins decides what the link means:
 *
 * 1. `&extendSession=true` alongside the shorthand, which outranks even a hub.
 * 2. `&hubURL=`, above the bare shorthand, because a hub is the only param that
 *    brings its own assemblies and tracks — a link carrying both is asking to
 *    navigate *inside* the hub. Ranking the shorthand first builds a bare LGV
 *    and drops the hub with no diagnostic.
 * 3. the shorthand on its own.
 */
function shorthandSpec(params: URLSearchParams): ParsedSessionSpec['spec'] {
  const init = buildLgvInitFromParams(params)
  // what makes a link a jb1-style one, the same test as jbrowse-web's
  // isJb1StyleSession. The rest of the shorthand only modifies a view; none of
  // it can conjure one.
  const isJb1Style = init.loc !== undefined || init.assembly !== undefined

  // `&extendSession=true` means "apply this shorthand to the config's own
  // defaultSession", and there is no honest way to do that here: this builds a
  // session spec, and loadSessionSpec replaces the session rather than
  // navigating one the config supplied. Opening the view without the
  // defaultSession's curated tracks would quietly be a different session than
  // the link asks for, so say so instead — and say what to remove, since the
  // link works fine without it.
  //
  // Gated on the shorthand being present for the same reason web's branch is:
  // the param names the default session as the thing to navigate, and with no
  // loc or assembly there is no navigation to apply to it.
  if (isJb1Style && params.get('extendSession') === 'true') {
    throw new Error(
      'That link uses "&extendSession=true", which layers its location onto a defaultSession that only the JBrowse Web instance it points at can supply. Remove that parameter to open just the view the link describes.',
    )
  }

  const hubURL = readHubUrlParam(params.get('hubURL') ?? undefined)
  if (hubURL.length) {
    // A track hub is a session connection, which a spec has carried since
    // sessionConnections landed. So this is no longer the dead end it was
    // ("that's a track hub, go add it by hand") — the hub attaches, and
    // loadSessionSpec waits for it to settle before launching anything, because
    // the assemblies and tracks the view below names are ones the hub brings.
    return {
      sessionConnections: hubURL.map(hubConnectionSpec),
      sessionTracks: readSessionTracks(params),
      // Only with an assembly. The launcher resolves everything against one,
      // and a hub's assemblies are genome ids only the hub carries, so `&loc=`
      // alone has nothing to launch against. Leaving the list empty is what
      // makes loadSessionSpec register the connection non-silently, so the hub
      // opens at its own defaultPos — the best guess available without a name,
      // and what jbrowse-web does with the same link.
      views: init.assembly === undefined ? [] : [lgvSpec(init)],
    }
  }

  if (!isJb1Style) {
    throw new Error(
      'That link has no session in it. Copy a JBrowse Web link that contains "&session=spec-...", or one with "&assembly=" and "&loc=".',
    )
  }
  return {
    // `&sessionTracks=` carries whole track configs the views then reference by
    // id, exactly as in a spec link
    sessionTracks: readSessionTracks(params),
    views: [lgvSpec(init)],
  }
}

// The init keys are LGV `InitState` ones the LaunchView-LinearGenomeView
// extension point partitions for itself; ViewSpec carries only what every view
// type has, which is why this spreads rather than naming them.
function lgvSpec(init: LgvUrlInit): ViewSpec {
  return { type: 'LinearGenomeView', ...init }
}

function readSessionTracks(params: URLSearchParams) {
  const sessionTracks = params.get('sessionTracks')
  if (!sessionTracks) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(sessionTracks)
  } catch (e) {
    throw new Error(`The "sessionTracks" in that link isn't valid JSON: ${e}`, {
      cause: e,
    })
  }
  if (!Array.isArray(parsed)) {
    throw new Error(
      'The "sessionTracks" in that link is not a list of track configurations.',
    )
  }
  return parsed as Record<string, unknown>[]
}

export function parseSessionSpecUrl(input: string): ParsedSessionSpec {
  let url: URL
  try {
    url = unwrapProtocolUrl(new URL(input.trim()))
  } catch {
    throw new Error(`Not a URL: ${input}`)
  }

  const params = linkParams(url)
  const session = params.get('session')
  if (!session) {
    return {
      ...resolveConfig(params, url),
      spec: shorthandSpec(params),
      sessionName: params.get('sessionName') ?? undefined,
    }
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

  return {
    ...resolveConfig(params, url),
    spec,
    sessionName: params.get('sessionName') ?? undefined,
  }
}
