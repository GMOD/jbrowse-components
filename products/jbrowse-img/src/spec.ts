import fs from 'node:fs'

import { mergeSettings } from '@jbrowse/launch-args'

import { viewTypeModes } from './modes.ts'
import { STDIN_ARG, isFile, readStdin } from './util.ts'

import type { ViewMode } from './modes.ts'

// A parsed --spec view object: the same shape as a web session-spec view (see
// urlparams.md). `type` selects the render mode; the remaining fields ARE the
// view's settings (sub-views + level-indexed tracks for comparative views), so
// they pass straight to addLaunchView.
export interface ViewSpec {
  type: string
  [key: string]: unknown
}

// Accepts the documented `{ views: [viewObject] }` wrapper (so JSON copied from
// a `&session=spec-` URL works) or a bare view object. Reads stdin for `-`, a
// file when `spec` is a path, else parses it as inline JSON.
// Inline JSON opens with a brace or a bracket, so anything else that is not a
// file on disk is a path that isn't there. Left to JSON.parse, a mistyped
// `--spec synteny.jsno` came back as `Unexpected token 's'`, which reads as a
// malformed spec rather than as the missing file it is.
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

// The view snapshot a comparative renderer feeds to addLaunchView: the spec
// minus its `type` discriminator. Every setting is already written on the view
// object, which is the one shape a view takes.
export function viewSettingsFromSpec({
  type,
  ...settings
}: ViewSpec): Record<string, unknown> {
  return settings
}

/**
 * `settings` with `--view`'s written over them, member by member, so
 * `--view mark.interpolate=bump` keeps a spec's other `mark` members.
 */
export function withViewSettings<T extends object>(
  settings: T,
  view: Record<string, unknown> = {},
): T {
  return mergeSettings(
    structuredClone(settings) as Record<string, unknown>,
    view,
  ) as T
}
