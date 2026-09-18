import { hubUrl } from './hub.ts'
import { sessionSpecParam } from './session.ts'

// The public JBrowse Web build the docs' own figure links point at. Any other
// deployment works the same way, including a local `npx serve` of a build.
export const PUBLIC_INSTANCE = 'https://jbrowse.org/code/jb2/latest/'

export interface JBrowseUrlOptions {
  /** A genomes.jbrowse.org assembly: a UCSC db name (`hg38`) or GenArk accession. */
  hub?: string
  /** A config.json URL, for data that is not on genomes.jbrowse.org. Wins over `hub`. */
  config?: string
  /** Assembly to open. Defaults to `hub`, whose config names its assembly after it. */
  assembly?: string
  /**
   * Where to open. A locstring (`chr1:1,000-2,000`, several space-separated for
   * a discontinuous view), or — on a config that ships a text index, which every
   * UCSC assembly on genomes.jbrowse.org does — a feature name such as `BRCA1`.
   */
  loc?: string
  /** trackIds from the config to open. */
  tracks?: string[]
  /** The full session spec, for anything the three fields above cannot say. */
  session?: object
  /** Name the session carries once opened. */
  sessionName?: string
  /** JBrowse Web deployment to load. Defaults to the public one. */
  instance?: string
}

/**
 * The URL that opens a JBrowse Web instance onto a described view. Useful on its
 * own: an agent can hand this to a human, or paste it into a report, without
 * launching a browser at all.
 *
 * Two ways to say where to go, and they are not interchangeable. `assembly` /
 * `loc` / `tracks` become the [URL parameters](https://jbrowse.org/jb2/docs/urlparams/),
 * which route `loc` through the config's text-search index, so a **gene name**
 * works there. `session` becomes a
 * [session spec](https://jbrowse.org/jb2/docs/urlparams/#session-spec), which
 * can describe several views and per-display settings but whose `init.loc` is
 * parsed as a locstring only and throws on a gene name. Pass one or the other:
 * `&loc=` starts a fresh session, so the URL cannot carry both.
 */
export function jbrowseUrl({
  hub,
  config,
  assembly,
  loc,
  tracks,
  session,
  sessionName,
  instance = PUBLIC_INSTANCE,
}: JBrowseUrlOptions) {
  if (session && (assembly || loc || tracks?.length)) {
    throw new Error(
      'a session spec says which assembly, locations and tracks to open, so it ' +
        'cannot be combined with assembly, loc or tracks (--assembly, --loc, ' +
        '--track): put them in the spec',
    )
  }
  // In the fragment, which never reaches a server: a whole session spec in the
  // query string can exceed the request-line limit and come back HTTP 414.
  const params = new URLSearchParams()
  const set = (key: string, value: string | undefined) => {
    if (value) {
      params.set(key, value)
    }
  }
  set('config', config ?? (hub ? hubUrl(hub) : undefined))
  if (session) {
    set('session', sessionSpecParam(session))
  } else {
    set('assembly', assembly ?? hub)
    set('loc', loc)
    set('tracks', tracks?.join(','))
  }
  set('sessionName', sessionName)
  const url = new URL(instance)
  url.hash = params.toString()
  return url.href
}
