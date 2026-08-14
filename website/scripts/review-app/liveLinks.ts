import type { LiveBases } from '../review-payload.ts'

// Which app a card's "open live" link opens in.
//
// The figures are captured against a build on this machine, so a review of an
// unreleased change is routinely a review of something the hosted build cannot
// show: the link under the picture then opens a DIFFERENT app from the one the
// picture came out of, and quietly disagrees with it. Pointing the links at a
// local `pnpm start` is how that gets checked.
//
// Every liveUrl the server sends is `${CODE_BASE}${spec.url}`, so retargeting
// one is a prefix swap and nothing else. The exception is a spec whose url is
// absolute already (the three genomes.jbrowse.org site figures): it does not
// carry the prefix, so it keeps the link it had rather than becoming a
// localhost 404 — which is why liveHref returns the original rather than
// nothing.

export type LiveWhich = 'hosted' | 'local'

export const LIVE_WHICH = ['hosted', 'local'] as const

export interface LiveTarget {
  from: string
  to: string
}

export function liveTargetOf(
  bases: LiveBases | undefined,
  which: LiveWhich,
): LiveTarget | undefined {
  return bases && which === 'local'
    ? { from: bases.hosted, to: bases.local }
    : undefined
}

export function liveHref(url: string, target: LiveTarget | undefined) {
  return target && url.startsWith(target.from)
    ? `${target.to}${url.slice(target.from.length)}`
    : url
}

// What to call a base in the header select. The scheme and the trailing slash
// are noise in a control naming two places; the path is not, since
// `code/jb2/main` and `code/jb2/latest` are the distinction that matters on the
// hosted side.
const baseLabel = (base: string) =>
  base.replace(/^https?:\/\//, '').replace(/\/$/, '')

// Both of them, for the control that chooses between them. The bases arrive
// with the figure state, which lands before the first card is drawn — until then
// the control still has to say which option is which.
export const liveLabelsOf = (
  bases: LiveBases | undefined,
): Record<LiveWhich, string> => ({
  hosted: bases ? baseLabel(bases.hosted) : 'hosted build',
  local: bases ? baseLabel(bases.local) : 'local dev server',
})

// Where a link actually goes, for the tooltip on one. The host alone: the rest
// of a live URL is an encoded session, which is unreadable in a tooltip and long
// enough to cover the card.
export const linkHost = (url: string) =>
  url.replace(/^https?:\/\//, '').split('/')[0] ?? url
