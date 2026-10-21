// A session-spec key JBrowse does not declare reaches the app as an error
// snackbar, which fails a capture only after the browser has loaded the data.
// This finds it from the spec list, against the same schema `jbrowse validate`
// uses: each view through `$defs/View`, and the session tracks as a config.

import { schemaProblems } from '../../products/jbrowse-cli/src/commands/validate/schemaValidate.ts'
import { validateConfig } from '../../products/jbrowse-cli/src/commands/validate/validateConfig.ts'
import {
  defaultDisplay,
  lookupTrack,
  viewTrackEntries,
} from '../src/lib/spec-recipe/configs.ts'
import {
  decodeSpecUrl,
  specDisplayType,
  specTrackId,
} from '../src/lib/spec-recipe/decode.ts'

import type { ScreenshotSpec } from './screenshot-spec-types.ts'

function specUrls(list: ScreenshotSpec[]) {
  return list.flatMap(spec =>
    spec.mode === 'url'
      ? [
          { where: spec.name, url: spec.url },
          ...(spec.stages ?? []).flatMap((stage, i) =>
            stage.url
              ? [{ where: `${spec.name} stage ${i}`, url: stage.url }]
              : [],
          ),
        ]
      : [],
  )
}

function sessionTrackProblems(tracks: Record<string, unknown>[]) {
  const assemblyNames = new Set(
    tracks.flatMap(t =>
      Array.isArray(t.assemblyNames) ? (t.assemblyNames as string[]) : [],
    ),
  )
  return validateConfig({
    tracks,
    assemblies: [...assemblyNames].map(name => ({ name, uri: `${name}.2bit` })),
  }).problems.filter(
    p => p.level === 'error' && !p.where.startsWith('assemblies'),
  )
}

export function sessionSchemaProblems(list: ScreenshotSpec[]) {
  return specUrls(list).flatMap(({ where, url }) => {
    const decoded = decodeSpecUrl(url)
    if (!decoded) {
      return []
    }
    const { views = [], sessionTracks = [] } = decoded.spec
    return [
      ...sessionTrackProblems(sessionTracks).map(
        p => `${where}: sessionTracks: ${p.where}: ${p.message}`,
      ),
      ...views.flatMap((view, i) =>
        schemaProblems(view, '/$defs/View').map(
          p => `${where}: views[${i}].${p.where}: ${p.message}`,
        ),
      ),
    ]
  })
}

// A track entry's `type` that names the display the app opens it as anyway.
export function redundantDisplayTypes(list: ScreenshotSpec[]) {
  return specUrls(list).flatMap(({ where, url }) => {
    const decoded = decodeSpecUrl(url)
    if (!decoded) {
      return []
    }
    const { config, spec } = decoded
    return viewTrackEntries(spec.views).flatMap(({ entry, viewType }) => {
      const type = specDisplayType(entry)
      const trackId = specTrackId(entry)
      return type !== undefined &&
        viewType !== undefined &&
        type ===
          defaultDisplay(
            lookupTrack(config, trackId, spec.sessionTracks),
            viewType,
          )
        ? [
            `${where}: "${trackId}" names type ${type}, which a ${viewType} opens it as anyway; drop the type`,
          ]
        : []
    })
  })
}
