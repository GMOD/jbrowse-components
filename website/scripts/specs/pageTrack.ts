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

// The lines under the heading `section` names, down to the next heading of the
// same or a higher level.
function sectionText(text: string, section: string) {
  const lines = text.split('\n')
  let fenced = false
  const headingLevel = lines.map(line => {
    if (line.startsWith('```')) {
      fenced = !fenced
    }
    return fenced ? 0 : (/^(#{1,6}) /.exec(line)?.[1]!.length ?? 0)
  })
  const start = lines.findIndex(
    (line, i) => headingLevel[i]! > 0 && line.replace(/^#+ /, '') === section,
  )
  if (start === -1) {
    return undefined
  }
  const end = headingLevel.findIndex(
    (level, i) => i > start && level > 0 && level <= headingLevel[start]!,
  )
  return lines.slice(start, end === -1 ? undefined : end).join('\n')
}

/**
 * The text of the `json addtrack` fence `doc` prints for `trackId`, as a
 * reader copies it: what a tour types into a paste box. A page restating a
 * track as a section adds to it names the section. Throws when the page prints
 * no such track, so a renamed trackId fails the spec rather than drawing or
 * typing a stale copy.
 */
export function pageFenceText(doc: string, trackId: string, section?: string) {
  const text = readFileSync(join(docsDir, doc), 'utf8')
  const scope = section === undefined ? text : sectionText(text, section)
  for (const [, body] of scope?.matchAll(ADDTRACK_FENCE) ?? []) {
    if ((JSON.parse(body!) as PageTrackConfig).trackId === trackId) {
      return body!
    }
  }
  throw new Error(
    `${doc} prints no json addtrack fence for ${trackId}${section ? ` under "${section}"` : ''}`,
  )
}

/**
 * The track config `doc` prints for `trackId`, for a figure to load exactly
 * what the page tells a reader to paste. A page that names its files by bare
 * filename (the reader's own copy) gets them resolved against `base`, where the
 * hosted copies live.
 */
export function pageTrack(
  doc: string,
  trackId: string,
  { base, section }: { base?: string; section?: string } = {},
): PageTrackConfig {
  const config = JSON.parse(
    pageFenceText(doc, trackId, section),
  ) as PageTrackConfig
  return (base ? resolveUris(config, base) : config) as PageTrackConfig
}
