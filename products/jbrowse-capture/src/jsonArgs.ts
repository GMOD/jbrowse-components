import { readFileSync } from 'node:fs'

import type { Annotation } from './annotationOverlay.ts'

// inline JSON, `-` for stdin, or a path: the forms `jb2export --spec` reads
function parseJson(value: string): unknown {
  const inline = /^\s*[[{]/.test(value)
  return JSON.parse(
    value === '-'
      ? readFileSync(0, 'utf8')
      : inline
        ? value
        : readFileSync(value, 'utf8'),
  )
}

export function readJson(flag: string, value: string): object {
  const parsed = parseJson(value)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--${flag} must be a JSON object`)
  }
  return parsed
}

export function readAnnotations(value: string): Annotation[] {
  const parsed = parseJson(value)
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
