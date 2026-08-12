import { parseRegionNames } from '@jbrowse/core/util'

// The `&loc=`/`&assembly=`/`&tracks=`/... URL shorthand, normalized into the
// LinearGenomeView init that a session spec's view entry carries.
//
// jbrowse-web has read these since JBrowse 1 and turns them into a spec of
// exactly one LGV (SessionLoader's decodeJb1StyleSession). This lives here, with
// parseSessionSpecUrl, because anything *else* holding such a URL — Desktop
// opening a pasted link or a jbrowse:// one — has to resolve it to the same
// view, and the decoding below has enough deliberate asymmetry in it that a
// second implementation would not.

// The result shape. Structurally a `Partial<InitState>` from
// @jbrowse/plugin-linear-genome-view, which is what the LaunchView-<type>
// extension point consumes — but app-core does not depend on that plugin, so it
// is restated rather than imported. jbrowse-web's buildLgvInit wrapper is
// annotated with the real type and so is where the two are checked against each
// other; if this ever stops being assignable, that is where it fails.
export interface LgvUrlInit {
  loc?: string
  assembly?: string
  tracks?: string[]
  tracklist?: boolean
  nav?: boolean
  highlight?: string[]
  displayedRegionNames?: string[]
}

// split a space-separated &highlight= URL param into individual highlights.
// spaces inside a JSON object ({...}) are not treated as delimiters, so a
// highlight like {"refName":"chr1","start":1,"end":2,"label":"my region"}
// survives intact alongside plain loc strings
export function splitHighlights(str: string) {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '{') {
      depth++
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1)
    }
    if (ch === ' ' && depth === 0) {
      if (cur) {
        out.push(cur)
      }
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur) {
    out.push(cur)
  }
  return out
}

/**
 * `&tracklist=` — only the literal `true` turns the track selector on.
 *
 * Absent stays absent rather than collapsing into the param's default:
 * buildLgvInit's result is layered over a defaultSession's own pending init, so
 * a `false` synthesized here would overwrite what that session set.
 */
export function readTracklistParam(value: string | undefined) {
  return value === undefined ? undefined : value === 'true'
}

/**
 * `&nav=` — anything but the literal `false` leaves the navigation bar on.
 *
 * The opposite default to tracklist above, and deliberately so: the nav bar is
 * on unless a link turns it off, the track selector is off unless a link turns
 * it on. Absent stays absent for the same reason as tracklist.
 */
export function readNavParam(value: string | undefined) {
  return value === undefined ? undefined : value !== 'false'
}

/**
 * Normalizes already-decoded shorthand values into an LGV init.
 *
 * A param the URL omits is left off the result rather than set to undefined:
 * jbrowse-web's applyDefaultSessionViewInit merges this over the view's own
 * pending init, and a present-but-undefined key there would erase what the
 * defaultSession set.
 */
export function buildLgvInit(args: {
  loc?: string
  tracks?: string
  assembly?: string
  tracklist?: boolean
  nav?: boolean
  highlight?: string
  regions?: string
}): LgvUrlInit {
  const { loc, tracks, assembly, tracklist, nav, highlight, regions } = args
  const init: LgvUrlInit = {}
  if (loc !== undefined) {
    init.loc = loc
  }
  if (assembly !== undefined) {
    init.assembly = assembly
  }
  if (tracks !== undefined) {
    init.tracks = tracks.split(',')
  }
  if (tracklist !== undefined) {
    init.tracklist = tracklist
  }
  if (nav !== undefined) {
    init.nav = nav
  }
  if (highlight !== undefined) {
    init.highlight = splitHighlights(highlight)
  }
  if (regions !== undefined) {
    // restrict a whole-genome view (no loc) to these named chromosomes, in
    // order; resolved through assembly aliases in afterAttach's showNamedRegions
    //
    // Through core's parser, the same one the import forms' chromosome boxes
    // use, rather than a bare split: this is one syntax with one meaning, and
    // the second reading of it dropped `chr2` from `&regions=chr1,%20chr2`
    // without a word. Empty entries go with it — a present-but-empty
    // `&regions=` is still truthy, and the list of one empty name it used to
    // produce reported itself as having matched nothing. Same trap as
    // readHubUrlParam below.
    const names = parseRegionNames(regions)
    if (names.length) {
      init.displayedRegionNames = names
    }
  }
  return init
}

/**
 * `&hubURL=` — a comma-separated list of hub.txt urls.
 *
 * Empty entries are dropped, so `&hubURL=` and `&hubURL=,,` are no hubs at all
 * rather than a list of blanks. jbrowse-web learned that the hard way: a
 * present-but-empty param is still truthy, which routed the load to a hub
 * builder with no url to connect to and produced a session with nothing in it
 * and no diagnostic.
 */
export function readHubUrlParam(value: string | undefined) {
  return value?.split(',').filter(Boolean) ?? []
}

/**
 * A short, readable label for a hub connection, before its hub.txt has been
 * read: the second-to-last path segment, which for `…/myHub/hub.txt` is the
 * hub's own directory. Beats showing the whole url in a track-selector category
 * header.
 */
export function shortHubLabel(url: string) {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return segments.at(-2) ?? segments.at(-1) ?? url
  } catch {
    return url
  }
}

/**
 * The `sessionConnections` entry for a hub url — the spec vocabulary for "attach
 * this track hub", which loadSessionSpec registers before it launches any view.
 */
export function hubConnectionSpec(url: string) {
  return {
    type: 'UCSCTrackHubConnection',
    connectionId: url,
    name: shortHubLabel(url),
    hubTxtLocation: { uri: url, locationType: 'UriLocation' },
  }
}

// URLSearchParams.get returns null for an absent param, and every reader here
// distinguishes absent from present-and-empty
function read(params: URLSearchParams, key: string) {
  return params.get(key) ?? undefined
}

/**
 * The same init, read straight off a link's params. jbrowse-web decodes these
 * into its loader's own properties first (they have to survive an HMR reload),
 * so it calls buildLgvInit above; a caller holding a whole URL wants this.
 */
export function buildLgvInitFromParams(params: URLSearchParams): LgvUrlInit {
  return buildLgvInit({
    loc: read(params, 'loc'),
    assembly: read(params, 'assembly'),
    tracks: read(params, 'tracks'),
    tracklist: readTracklistParam(read(params, 'tracklist')),
    nav: readNavParam(read(params, 'nav')),
    highlight: read(params, 'highlight'),
    regions: read(params, 'regions'),
  })
}
