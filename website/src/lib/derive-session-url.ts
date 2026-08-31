// Derive the live-app URL that opens a `defaultSession` block, for the third
// tab on a ```json session fence.
//
// `&session=json-` is the URL form that carries a session SNAPSHOT — jbrowse-web
// parses it as `{ session }` and hands it to loadImportedSession, the same path
// a config's defaultSession takes, so a block written for one opens under the
// other unchanged. `spec-`, which the figure specs use, wraps the same view
// objects in a spec the launchers consume instead.
//
// The tab is opt-in per fence, via `config=<url>` in the fence meta, because the
// URL needs something the block does not carry. A defaultSession names trackIds
// and assemblies; which config those live in is the reader's own install for the
// CLI tab, and has to be an absolute URL here. Most doc sessions are
// illustrations against a config nobody hosts, and a live link to one of those
// is worse than no link at all — so a fence gets this tab only when an author
// names a config that really serves it.

import { CODE_BASE } from './code-base.ts'
import { asRecord } from './derive-cli-command.ts'
import { defaultSessionObject } from './derive-set-default-session.ts'

// `config=<url>` out of a fence's meta string, e.g.
// ```json session config=https://jbrowse.org/demos/ecoli_pangenome/config.json
export function sessionConfigUrl(meta: string | null | undefined) {
  return /(^|\s)config=(\S+)/.exec(meta ?? '')?.[2]
}

/**
 * Every trackId and assembly name a session asks for, wherever they sit.
 *
 * Deliberately shape-blind: a session's tracks sit on the view for a launching
 * view, one array deep per band for a synteny view, and inside built track
 * snapshots for an app-exported one. Enumerating those shapes here would make
 * this a second, worse copy of the launcher; walking for `tracks` arrays and
 * `assembly` keys answers the only question the check asks, which is whether
 * every name the session mentions exists in the config it points at.
 */
export function namesInSession(session: unknown) {
  const trackIds = new Set<string>()
  const assemblies = new Set<string>()
  const walk = (value: unknown, key?: string) => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, key)
      }
    } else if (typeof value === 'string') {
      if (key === 'tracks') {
        trackIds.add(value)
      } else if (key === 'assembly') {
        assemblies.add(value)
      }
    } else if (value !== null && typeof value === 'object') {
      const record = asRecord(value)
      // a track entry inside a `tracks` array may be `{ trackId, ...display }`
      if (key === 'tracks' && typeof record.trackId === 'string') {
        trackIds.add(record.trackId)
      }
      for (const [k, v] of Object.entries(record)) {
        walk(v, k)
      }
    }
  }
  walk(session)
  return { trackIds: [...trackIds], assemblies: [...assemblies] }
}

export function deriveSessionUrl(
  config: unknown,
  meta: string | null | undefined,
) {
  const session = defaultSessionObject(config)
  const configUrl = sessionConfigUrl(meta)
  if (session === null || configUrl === undefined) {
    return undefined
  }
  // config is percent-encoded because it is an absolute URL with its own `:`
  // and `/`; the session likewise, since its JSON carries `&`, `#` and `+`,
  // each of which ends or corrupts the param where it stands raw.
  return `${CODE_BASE}?config=${encodeURIComponent(configUrl)}&session=${encodeURIComponent(
    `json-${JSON.stringify({ session })}`,
  )}`
}
