import fs from 'node:fs'

import { mergeSettings } from '@jbrowse/launch-args'

import { viewTypeModes } from './modes.ts'
import { STDIN_ARG, isFile, readStdin } from './util.ts'

import type { ViewMode } from './modes.ts'

// A web session-spec view (see urlparams.md)
export interface ViewSpec {
  type: string
  [key: string]: unknown
}

// Inline JSON opens with a brace or a bracket, so anything else that is not a
// file is a missing path rather than malformed JSON.
function specText(spec: string) {
  if (spec === STDIN_ARG) {
    return readStdin()
  }
  if (isFile(spec)) {
    return fs.readFileSync(spec, 'utf8')
  }
  if (!/^\s*[[{]/.test(spec)) {
    throw new Error(
      `--spec "${spec}": no such file. Pass a path to a .json, the JSON itself, or "-" to read it from stdin`,
    )
  }
  return spec
}

// Takes a bare view or the `{ views: [...] }` wrapper a `&session=spec-` URL has
export function parseSpec(spec: string): ViewSpec {
  const raw = specText(spec)
  const obj = JSON.parse(raw) as Record<string, unknown>
  const view =
    typeof obj.type === 'string'
      ? obj
      : Array.isArray(obj.views)
        ? (obj.views[0] as Record<string, unknown> | undefined)
        : undefined
  if (!view || typeof view.type !== 'string') {
    throw new Error(
      '--spec JSON must be a view object (or a { views: [...] } wrapper) with a "type" field',
    )
  }
  return view as ViewSpec
}

export function specMode(spec: ViewSpec): ViewMode {
  const mode = viewTypeModes.get(spec.type)
  if (!mode) {
    throw new Error(
      `unsupported view type in --spec: ${spec.type} (supported: ${[...viewTypeModes.keys()].join(', ')})`,
    )
  }
  return mode
}

export function viewSettingsFromSpec({
  type,
  ...settings
}: ViewSpec): Record<string, unknown> {
  return settings
}

// Merged member by member, so `--view mark.interpolate=bump` keeps a spec's
// other `mark` members.
export function withViewSettings<T extends object>(
  settings: T,
  view: Record<string, unknown> = {},
): T {
  return mergeSettings(
    structuredClone(settings) as Record<string, unknown>,
    view,
  ) as T
}
