import fs from 'node:fs'

import { viewTypeModes } from './modes.ts'
import { STDIN_ARG, readStdin } from './util.ts'

import type { ViewMode } from './modes.ts'
import type { Track } from './types.ts'

// A parsed --spec view object: the same shape as a web session-spec view (see
// urlparams.md). `type` selects the render mode; the remaining fields ARE the
// view's `init` snapshot (sub-views + level-indexed tracks for comparative
// views), so they pass straight to addInitView.
export interface ViewSpec {
  type: string
  [key: string]: unknown
}

export interface ParsedSpec {
  view: ViewSpec
  // Whole track configs the spec carries alongside its view, the session-spec
  // `sessionTracks` key. A view names these by trackId like any other, so they
  // have to reach the config before the view is built.
  sessionTracks: Track[]
}

// Accepts the documented `{ views: [viewObject] }` wrapper (so JSON copied from
// a `&session=spec-` URL works) or a bare view object. Reads stdin for `-`, a
// file when `spec` is a path, else parses it as inline JSON.
//
// The wrapper's `sessionTracks` come back too. They used to be dropped on the
// floor while the view they belong to was kept, which made the "JSON copied
// from a &session=spec- URL works" promise above false for exactly the specs
// that need it: the view then named a trackId nothing in the config had, and
// the run died on `Could not resolve identifier "..."` — a message that reads
// like a bad spec rather than like a key this parser ignored.
export function parseSpec(spec: string): ParsedSpec {
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
  return {
    view: view as ViewSpec,
    sessionTracks: Array.isArray(obj.sessionTracks)
      ? (obj.sessionTracks as Track[])
      : [],
  }
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

// The view-init snapshot a comparative renderer feeds to addInitView: the spec
// minus its `type` discriminator.
export function initFromSpec({ type, ...init }: ViewSpec) {
  return init
}
