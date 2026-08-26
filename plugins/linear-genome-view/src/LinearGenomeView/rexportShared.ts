import { getConf } from '@jbrowse/core/configuration'
import { getContainingTrack } from '@jbrowse/core/util'

/**
 * Shared codegen primitives for the R script exporters. Every display's
 * `exportRCode.ts` builds pure-ggplot2 fragments, and they all need the same few
 * things: quote a string as an R literal, turn a trackId into a safe R variable
 * name, and pull the trackId / name / adapter off the containing track. Keeping
 * one copy means the quoting/escaping rules can't drift between track types.
 */

/** Quote an arbitrary string as an R string literal (escaping \\ and "). */
export function rStr(s: string) {
  return `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

/**
 * A safe R variable/identifier derived from a trackId.
 *
 * The leading character is the whole subtlety: R accepts letters and `.` there
 * but NOT a digit and NOT an underscore, so prefixing a digit with `_` (the
 * obvious guard, and what this did) produces `_1KGP_3202…`, which R rejects at
 * PARSE time — `unexpected numeric constant`. The whole script then fails to
 * run, from any track whose id starts with a digit: `1000g_…`, `1KGP_…`, a
 * chromosome-named track. Prefix with a letter instead.
 */
export function safeVarName(str: string) {
  return str.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(?=[\d_])/, 'x')
}

/**
 * The frame a panel was built from, for a fragment that binds its data
 * (`RTrackFragment.dataExpr`): `p_foo` -> `d_foo`. One rule in one place,
 * because two sides have to agree on the name — assembleRScript emits the
 * assignment, and the fragment's own `plotExpr` reads it back.
 */
export function rDataVariable(plotVariable: string) {
  return plotVariable.replace(/^p_/, 'd_')
}

/**
 * The emitted figure's own geometry, single-sourced because two different
 * decisions read it and neither fails loudly when it drifts: assembleRScript
 * writes the trailing `ggsave()` from it, and a panel that has to estimate TEXT
 * width — which a ggplot cannot do, living in data space — sizes its labels
 * against it (`label_room`, and the multi-wiggle's per-source axis). Change the
 * ggsave width alone and label decimation silently mis-tunes, with nothing
 * anywhere saying so.
 */
export const FIGURE_WIDTH_INCHES = 12
export const FIGURE_DPI = 150
/** Inches of figure per unit of `RTrackFragment.heightWeight`. */
export const FIGURE_INCHES_PER_WEIGHT = 2

/** An R named-vector name in backticks — any string is valid when backtick
 * quoted, so strip stray backticks that would break the quoting. */
export function rName(s: string) {
  return `\`${s.replaceAll('`', '')}\``
}

/**
 * The path R should read, first non-empty among the given candidates (a config
 * fallback chain, since an adapter may spell its source in more than one slot).
 *
 * A candidate may be a bare string or a whole `FileLocation`, and taking the
 * location is what callers should do: a location is a `uri` **or** a
 * `localPath`, and reading only `.uri` emitted `path <- ""` for every
 * local-file track — jbrowse-desktop's normal case, and every file jb2export is
 * pointed at from disk. That failed in R, far from here, as an unreadable empty
 * path rather than as a missing export.
 */
export interface RFileLocation {
  uri?: string
  localPath?: string
  // Stamped next to every `uri` when a config is loaded from a url
  // (addRelativeUris), because a JBrowse config addresses its data RELATIVE TO
  // ITSELF — test_data/volvox/config.json says `volvox.test.vcf.gz`. The app
  // resolves that at fetch time; an R script has no such base, so an
  // unresolved uri lands in the script as a bare filename that R cannot open.
  baseUri?: string
}

export function firstUri(
  ...candidates: (string | RFileLocation | undefined)[]
) {
  for (const c of candidates) {
    if (typeof c === 'string') {
      if (c) {
        return c
      }
      continue
    }
    if (c?.uri) {
      return c.baseUri ? new URL(c.uri, c.baseUri).href : c.uri
    }
    if (c?.localPath) {
      return c.localPath
    }
  }
  return ''
}

export interface RTrackMeta<A> {
  trackId: string
  trackName: string
  /** safeVarName(trackId) — the R variable base for this track's fragment */
  pathVar: string
  adapter: A
}

/** Pull the trackId, display name, adapter config and R variable base off the
 * display's containing track — the identical preamble every exportRCode runs. */
export function getTrackRMeta<A>(self: unknown): RTrackMeta<A> {
  const track = getContainingTrack(self)
  const trackId: string = track.configuration.trackId
  const adapter: A = getConf(track, 'adapter')
  return {
    trackId,
    trackName: getConf(track, 'name') || trackId,
    pathVar: safeVarName(trackId),
    adapter,
  }
}
