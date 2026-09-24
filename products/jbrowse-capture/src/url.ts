import { hubUrl } from './hub.ts'
import { savedSessionParam, sessionSpecParam } from './session.ts'

export const PUBLIC_INSTANCE = 'https://jbrowse.org/code/jb2/latest/'

/**
 * The instance as the page that loads it sees it: a directory given without
 * its slash, which the host redirects, resolves relative URLs one level up.
 */
export function instanceUrl(instance = PUBLIC_INSTANCE) {
  const url = new URL(instance)
  if (!url.pathname.endsWith('/') && !/\.html?$/.test(url.pathname)) {
    url.pathname += '/'
  }
  return url
}

export interface JBrowseUrlOptions {
  /** A genomes.jbrowse.org assembly: a UCSC db name (`hg38`) or GenArk accession. */
  hub?: string
  /** A config.json URL, for data that is not on genomes.jbrowse.org. Wins over `hub`. */
  config?: string
  /** Assembly to open. Defaults to `hub`, whose config names its assembly after it. */
  assembly?: string
  /**
   * Where to open: a locstring (`chr1:1,000-2,000`, several space-separated
   * for a discontinuous view), or a feature name such as `BRCA1` on a config
   * with a text index, which every UCSC assembly on genomes.jbrowse.org has.
   */
  loc?: string
  /** trackIds from the config to open. */
  tracks?: string[]
  /** A session spec, for anything the three fields above cannot say. */
  spec?: object
  /**
   * A session saved with "Export session...": the `{ session: {...} }`
   * document, or the snapshot inside it.
   */
  session?: object
  /** Name the session carries once opened. */
  sessionName?: string
  /** JBrowse Web deployment to load. Defaults to the public one. */
  instance?: string
}

/**
 * A spec or a saved session says which assembly, locations and tracks to
 * open, so the URL carries one of the three ways of saying so, never two.
 */
export function assertSessionStandsAlone({
  spec,
  session,
  assembly,
  loc,
  tracks,
}: JBrowseUrlOptions) {
  if (spec && session) {
    throw new Error('pass a session spec or a saved session, not both')
  }
  if ((spec || session) && (assembly || loc || tracks?.length)) {
    throw new Error(
      'a session spec or saved session says which assembly, locations and ' +
        'tracks to open, so it cannot be combined with assembly, loc or tracks ' +
        '(--assembly, --loc, --track): put them in the session',
    )
  }
}

/**
 * The URL that opens a JBrowse Web instance onto a described view, for a
 * person to follow without launching a browser here.
 *
 * `assembly`/`loc`/`tracks` become the
 * [URL parameters](https://jbrowse.org/jb2/docs/urlparams/), whose `loc`
 * takes a gene name. `spec` becomes a
 * [session spec](https://jbrowse.org/jb2/docs/urlparams/#session-spec), which
 * can describe several views and per-display settings but whose `init.loc`
 * takes a locstring only. `session` opens a saved session as exported.
 */
export function jbrowseUrl({
  hub,
  config,
  assembly,
  loc,
  tracks,
  spec,
  session,
  sessionName,
  instance,
}: JBrowseUrlOptions) {
  assertSessionStandsAlone({ spec, session, assembly, loc, tracks })
  const params = new URLSearchParams()
  const set = (key: string, value: string | undefined) => {
    if (value) {
      params.set(key, value)
    }
  }
  set('config', config ?? (hub ? hubUrl(hub) : undefined))
  if (spec) {
    set('session', sessionSpecParam(spec))
  } else if (session) {
    set('session', savedSessionParam(session))
  } else {
    set('assembly', assembly ?? hub)
    set('loc', loc)
    set('tracks', tracks?.join(','))
  }
  set('sessionName', sessionName)
  const url = instanceUrl(instance)
  // the fragment never reaches a server, so a large spec cannot hit HTTP 414
  url.hash = params.toString()
  return url.href
}
