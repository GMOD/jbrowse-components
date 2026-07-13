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

/** A safe R variable/identifier derived from a trackId (leading digit → _N). */
export function safeVarName(str: string) {
  return str.replaceAll(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, '_$1')
}

/** An R named-vector name in backticks — any string is valid when backtick
 * quoted, so strip stray backticks that would break the quoting. */
export function rName(s: string) {
  return `\`${s.replaceAll('`', '')}\``
}

/** First non-empty uri among the given candidates (config fallback chain). */
export function firstUri(...candidates: (string | undefined)[]) {
  return candidates.find(Boolean) ?? ''
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
