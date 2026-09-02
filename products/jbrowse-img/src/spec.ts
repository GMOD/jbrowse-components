import fs from 'node:fs'

import { viewTypeModes } from './modes.ts'
import { STDIN_ARG, readStdin } from './util.ts'

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
export function parseSpec(spec: string): ViewSpec {
  const raw =
    spec === STDIN_ARG
      ? readStdin()
      : fs.existsSync(spec)
        ? fs.readFileSync(spec, 'utf8')
        : spec
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
//
// `knobs` are the CLI flags naming the same settings, and they win — the
// precedence `--loc` already has over a `--session`. `--spec view.json --alpha
// 0.2` used to parse and validate --alpha and then apply it nowhere. A knob
// builder drops its unset entries, so an absent flag leaves the spec's own
// value alone rather than overwriting it with undefined.
export function viewSettingsFromSpec(
  { type, ...settings }: ViewSpec,
  knobs: object = {},
): Record<string, unknown> {
  return { ...settings, ...knobs }
}
