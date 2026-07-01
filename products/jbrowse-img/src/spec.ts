import fs from 'node:fs'

import { modeDescriptors, viewModes } from './modes.ts'

import type { ViewMode } from './modes.ts'

// A parsed --spec view object: the same shape as a web session-spec view (see
// urlparams.md). `type` selects the render mode; the remaining fields ARE the
// view's `init` snapshot (sub-views + level-indexed tracks for comparative
// views), so they pass straight to addInitView.
export interface ViewSpec {
  type: string
  [key: string]: unknown
}

// Accepts the documented `{ views: [viewObject] }` wrapper (so JSON copied from
// a `&session=spec-` URL works) or a bare view object. Reads from a file when
// `spec` is a path, else parses it as inline JSON.
export function parseSpec(spec: string): ViewSpec {
  const raw = fs.existsSync(spec) ? fs.readFileSync(spec, 'utf8') : spec
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

// Inverse of modeDescriptors[mode].viewType: maps a --spec view `type` to the
// render mode. Built from the single mode table so a new view type is wired in
// one place.
const specTypeToMode: Record<string, ViewMode> = {}
for (const mode of viewModes) {
  const { viewType } = modeDescriptors[mode]
  if (viewType) {
    specTypeToMode[viewType] = mode
  }
}

export function specMode(spec: ViewSpec): ViewMode {
  const mode = specTypeToMode[spec.type]
  if (!mode) {
    throw new Error(
      `unsupported view type in --spec: ${spec.type} (supported: ${Object.keys(specTypeToMode).join(', ')})`,
    )
  }
  return mode
}

// The view-init snapshot a comparative renderer feeds to addInitView: the spec
// minus its `type` discriminator.
export function initFromSpec({ type, ...init }: ViewSpec) {
  return init
}
