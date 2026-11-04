import { readFileSync } from 'node:fs'

import type { Annotation } from './annotationOverlay.ts'
import type { CaptureOptions } from './capture.ts'
import type { SpecTrack } from './url.ts'

// inline JSON, `-` for stdin, or a path
function parseJson(flag: string, value: string): unknown {
  try {
    const inline = /^\s*[[{]/.test(value)
    return JSON.parse(
      value === '-'
        ? readFileSync(0, 'utf8')
        : inline
          ? value
          : readFileSync(value, 'utf8'),
    )
  } catch (error) {
    throw new Error(
      `${flag.includes(' ') ? flag : `--${flag}`}: ${error instanceof Error ? error.message : error}`,
      { cause: error },
    )
  }
}

export function readJson(flag: string, value: string): object {
  const parsed = parseJson(flag, value)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--${flag} must be a JSON object`)
  }
  return parsed
}

export function readAnnotations(value: string): Annotation[] {
  const parsed = parseJson('annotations', value)
  if (!Array.isArray(parsed)) {
    throw new Error('--annotations must be a JSON array of callouts')
  }
  return parsed as Annotation[]
}

// a bare view object is the one-view spec it would be wrapped in
export function readSpec(value: string): object {
  const spec = readJson('spec', value)
  return 'type' in spec && !('views' in spec) ? { views: [spec] } : spec
}

export interface BatchEntry {
  out: string
  genome?: string
  config?: string
  assembly?: string
  loc?: string
  /** trackIds, or `{ trackId, ...displaySettings }` */
  tracks?: SpecTrack[]
  /** settings written on the view, as a session spec's view holds them */
  view?: Record<string, unknown>
  /** A session spec inline, or a path to one. */
  spec?: object | string
  /** A session saved with File → Export session inline, or a path to one. */
  session?: object | string
  width?: number
  height?: number
  dpr?: number
  fullPage?: boolean
  /** Callouts inline, or a path to them. */
  annotations?: Annotation[] | string
}

const BATCH_KEYS = new Set<string>([
  'out',
  'genome',
  'config',
  'assembly',
  'loc',
  'tracks',
  'view',
  'spec',
  'session',
  'width',
  'height',
  'dpr',
  'fullPage',
  'annotations',
] satisfies (keyof BatchEntry)[])

export function readBatch(value: string): BatchEntry[] {
  const parsed = parseJson('batch manifest', value)
  if (!Array.isArray(parsed)) {
    throw new Error('the batch manifest must be a JSON array of captures')
  }
  for (const [i, entry] of parsed.entries()) {
    if (typeof entry?.out !== 'string') {
      throw new Error(`batch capture ${i} has no "out" image path`)
    }
    const unknown = Object.keys(entry).find(key => !BATCH_KEYS.has(key))
    if (unknown) {
      throw new Error(
        `batch capture ${i} has a key no capture reads: "${unknown}" (it takes ${[...BATCH_KEYS].join(', ')})`,
      )
    }
  }
  return parsed as BatchEntry[]
}

// Options that say the same thing two ways, of which a capture takes one:
// where the config comes from, and what the session opens.
const RIVALS = [
  [['genome'], ['config'], ['comparative']],
  [
    ['spec'],
    ['session'],
    ['assembly', 'loc', 'tracks', 'view'],
    ['comparative'],
  ],
]

const rivalsOf = (key: string) =>
  RIVALS.flatMap(groups =>
    groups.some(group => group.includes(key))
      ? groups.filter(group => !group.includes(key)).flat()
      : [],
  )

/**
 * One batch entry over the command line's defaults. An entry key replaces its
 * default and every default that says the same thing another way, so an entry
 * naming a `config` drops the line's `--genome`, and one naming a `loc` drops
 * its `--spec`.
 */
export function batchCapture(
  defaults: CaptureOptions,
  { spec, session, annotations, ...entry }: BatchEntry,
): CaptureOptions {
  const own: CaptureOptions = {
    ...entry,
    ...(spec ? { spec: typeof spec === 'string' ? readSpec(spec) : spec } : {}),
    ...(session
      ? {
          session:
            typeof session === 'string'
              ? readJson('session', session)
              : session,
        }
      : {}),
    ...(annotations
      ? {
          annotations:
            typeof annotations === 'string'
              ? readAnnotations(annotations)
              : annotations,
        }
      : {}),
  }
  const replaced: Record<string, undefined> = {}
  for (const key of Object.keys(own).flatMap(rivalsOf)) {
    replaced[key] = undefined
  }
  return { ...defaults, ...replaced, ...own }
}
