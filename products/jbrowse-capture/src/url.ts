import { genomeConfigUrl } from '@jbrowse/launch-args'

import { savedSessionParam, sessionSpecParam } from './session.ts'
import { version } from './version.ts'

import type { HostedComparative } from './hostedComparative.ts'

/** A session spec's track entry: a trackId, or one beside display settings. */
export type SpecTrack = string | ({ trackId: string } & Record<string, unknown>)

// the release this package shipped with; `latest/` trails a major behind
// during a beta
export const PUBLIC_INSTANCE = `https://jbrowse.org/code/jb2/v${version}/`

/**
 * The instance as the page that loads it sees it: a directory given without
 * its slash, which the host redirects, resolves relative URLs one level up.
 */
export function instanceUrl(instance = PUBLIC_INSTANCE) {
  const url = URL.parse(instance)
  if (!url || !['http:', 'https:', 'file:'].includes(url.protocol)) {
    throw new Error(`instance "${instance}" is not an http(s) or file URL`)
  }
  if (!url.pathname.endsWith('/') && !/\.html?$/.test(url.pathname)) {
    url.pathname += '/'
  }
  return url
}

export interface JBrowseUrlOptions {
  /** A genomes.jbrowse.org assembly: a UCSC db name (`hg38`) or GenArk accession. */
  genome?: string
  /** A config.json URL, for data that is not on genomes.jbrowse.org. Not combined with `genome`. */
  config?: string
  /** Assembly to open. Defaults to `genome`, whose config names its assembly after it. */
  assembly?: string
  /**
   * Where to open: a locstring (`chr1:1,000-2,000`, several space-separated
   * for a discontinuous view), or a feature name such as `BRCA1` on a config
   * with a text index, which every UCSC assembly on genomes.jbrowse.org has.
   */
  loc?: string
  /**
   * Tracks from the config to open: a trackId, or a trackId beside the display
   * settings to write, `{ trackId, height: 200 }`.
   */
  tracks?: SpecTrack[]
  /** Settings to write on the view, as a session spec's view holds them: `{ axis: { grid: false } }`. */
  view?: Record<string, unknown>
  /** A session spec, for what the fields above cannot say, such as several views. */
  spec?: object
  /**
   * A synteny view or dotplot of hosted genomes, one per row. `resolveAgainstConfig`
   * turns it into a `genome` and a `spec`, so `jbrowseUrl` takes it resolved.
   */
  comparative?: HostedComparative
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
 * One source for the config, never a genome and a config URL. A spec or a saved
 * session says which assembly, locations and tracks to open, so the URL carries
 * one of the three ways of saying so, never two.
 */
export function assertCoherentOptions({
  genome,
  config,
  spec,
  session,
  assembly,
  loc,
  tracks,
  view,
  comparative,
}: JBrowseUrlOptions) {
  if (comparative) {
    const linear = Object.entries({ config, assembly, loc, spec, session })
      .filter(([, value]) => value)
      .map(([key]) => `--${key}`)
    if (tracks?.length) {
      linear.push('--track')
    }
    if (linear.length) {
      throw new Error(
        `a synteny view or dotplot opens one row per --genome, at its loc:; ${linear.join(', ')} ${linear.length > 1 ? 'apply' : 'applies'} to a linear view`,
      )
    }
  }
  if (genome && config) {
    throw new Error(
      'pass a hosted genome or a config URL, not both (--genome, --config); name the assembly with --assembly',
    )
  }
  if (spec && session) {
    throw new Error('pass a session spec or a saved session, not both')
  }
  if (
    (spec || session) &&
    (assembly || loc || tracks?.length || hasSettings(view))
  ) {
    throw new Error(
      'a session spec or saved session says which assembly, locations and ' +
        'tracks to open, so it cannot be combined with assembly, loc, tracks ' +
        'or view (--assembly, --loc, --track, --view): put them in the session',
    )
  }
}

const hasSettings = (view: object | undefined) =>
  !!view && Object.keys(view).length > 0

/** The trackId a track entry opens. */
export const trackIdOf = (track: SpecTrack) =>
  typeof track === 'string' ? track : track.trackId

/**
 * Whether the options write settings, which only a session spec carries: the
 * URL parameters name tracks and a location, nothing more.
 */
export function needsSpec({ tracks, view }: JBrowseUrlOptions) {
  return hasSettings(view) || !!tracks?.some(t => typeof t !== 'string')
}

// the linear genome view the URL parameters would open, with the settings
function launchSpec({
  genome,
  assembly,
  loc,
  tracks,
  view,
}: JBrowseUrlOptions) {
  const name = assembly ?? genome
  if (!name) {
    throw new Error(
      'track and view settings open the view through a session spec, which names its assembly: pass --assembly',
    )
  }
  return {
    views: [
      {
        ...view,
        type: 'LinearGenomeView',
        assembly: name,
        ...(loc ? { loc } : {}),
        ...(tracks?.length ? { tracks } : {}),
      },
    ],
  }
}

/**
 * The URL that opens a JBrowse Web instance onto a described view, for a
 * person to follow without launching a browser here.
 *
 * `assembly`/`loc`/`tracks` become the
 * [URL parameters](https://jbrowse.org/jb2/docs/urlparams/), whose `loc`
 * takes a gene name, or a one-view session spec when a track or `view` writes
 * settings. `spec` becomes a
 * [session spec](https://jbrowse.org/jb2/docs/urlparams/#session-spec), which
 * can describe several views and per-display settings. `session` opens a saved
 * session as exported.
 */
export function jbrowseUrl({
  genome,
  config,
  assembly,
  loc,
  tracks,
  view,
  spec,
  session,
  sessionName,
  instance,
  comparative,
}: JBrowseUrlOptions) {
  if (comparative) {
    throw new Error(
      'a hosted comparative view needs its configs fetched: pass the options through resolveAgainstConfig first',
    )
  }
  const options = { genome, config, spec, session, assembly, loc, tracks, view }
  assertCoherentOptions(options)
  const params = new URLSearchParams()
  const set = (key: string, value: string | undefined) => {
    if (value) {
      params.set(key, value)
    }
  }
  set('config', config ?? (genome ? genomeConfigUrl(genome) : undefined))
  if (spec) {
    set('session', sessionSpecParam(spec))
  } else if (session) {
    set('session', savedSessionParam(session))
  } else if (needsSpec(options)) {
    set('session', sessionSpecParam(launchSpec(options)))
  } else {
    set('assembly', assembly ?? genome)
    set('loc', loc)
    set('tracks', tracks?.map(trackIdOf).join(','))
  }
  set('sessionName', sessionName)
  const url = instanceUrl(instance)
  // the fragment never reaches a server, so a large spec cannot hit HTTP 414
  url.hash = params.toString()
  return url.href
}
