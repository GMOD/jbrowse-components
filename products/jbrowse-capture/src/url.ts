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
 * parsed as a locstring only and throws on a gene name. Pass one or the other;
 * `session` wins, and the URL params are dropped rather than silently starting
 * the fresh session that `&loc=` otherwise forces.
 */
export function jbrowseUrl({
  hub,
  config,
  assembly = hub,
  loc,
  tracks,
  session,
  sessionName,
  instance = PUBLIC_INSTANCE,
}: JBrowseUrlOptions) {
  const configUrl = config ?? (hub ? hubUrl(hub) : undefined)
  const url = new URL(instance)
  // URL's own encoder, not a hand-built query string: a config URL contains
  // `://` and `?`, and a session spec is a whole JSON document, so appending
  // either raw produces a link that loads a truncated config and reports
  // nothing.
  const set = (key: string, value: string | undefined) => {
    if (value) {
      url.searchParams.set(key, value)
    }
  }
  set('config', configUrl)
  if (session) {
    set('session', sessionSpecParam(session))
  } else {
    set('assembly', assembly)
    set('loc', loc)
    set('tracks', tracks?.join(','))
  }
  set('sessionName', sessionName)
  return url.href
}
