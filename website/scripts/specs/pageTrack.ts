import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { docsDir } from '../paths.ts'

export interface PageTrackConfig extends Record<string, unknown> {
  trackId: string
}

const ADDTRACK_FENCE = /^```json addtrack[^\n]*\n([\s\S]*?)\n```$/gm

function resolveUris(value: unknown, base: string): unknown {
  if (Array.isArray(value)) {
    return value.map(v => resolveUris(v, base))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        key === 'uri' && typeof v === 'string' && !/^[a-z]+:/i.test(v)
          ? `${base}/${v}`
          : resolveUris(v, base),
      ]),
    )
  }
  return value
}

/**
 * The track config `doc` prints in a `json addtrack` fence, for a figure to
 * load exactly what the page tells a reader to paste. A page that names its
 * files by bare filename (the reader's own copy) gets them resolved against
 * `base`, where the hosted copies live. Throws when the page prints no such
 * track, so a renamed trackId fails the spec rather than drawing a stale copy.
 */
export function pageTrack(
  doc: string,
  trackId: string,
  { base }: { base?: string } = {},
): PageTrackConfig {
  const text = readFileSync(join(docsDir, doc), 'utf8')
  for (const [, body] of text.matchAll(ADDTRACK_FENCE)) {
    const config = JSON.parse(body!) as PageTrackConfig
    if (config.trackId === trackId) {
      return (base ? resolveUris(config, base) : config) as PageTrackConfig
    }
  }
  throw new Error(`${doc} prints no json addtrack fence for ${trackId}`)
}
