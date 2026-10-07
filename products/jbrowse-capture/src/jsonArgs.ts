import { readFileSync } from 'node:fs'

import type { Annotation } from './annotationOverlay.ts'

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
  hub?: string
  config?: string
  assembly?: string
  loc?: string
  tracks?: string[]
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

export function readBatch(value: string): BatchEntry[] {
  const parsed = parseJson('batch manifest', value)
  if (!Array.isArray(parsed)) {
    throw new Error('the batch manifest must be a JSON array of captures')
  }
  for (const [i, entry] of parsed.entries()) {
    if (typeof entry?.out !== 'string') {
      throw new Error(`batch capture ${i} has no "out" image path`)
    }
  }
  return parsed as BatchEntry[]
}
