import { repoConfigPath } from '../src/lib/spec-recipe/configs.ts'
import {
  decodeSpecUrl,
  specTrackId,
  specTracks,
} from '../src/lib/spec-recipe/decode.ts'

import type { SpecView } from '../src/lib/spec-recipe/decode.ts'

export interface HostedReference {
  trackIds: Set<string>
  assemblyNames: Set<string>
}

function walk(view: SpecView, into: HostedReference) {
  for (const entry of specTracks(view)) {
    into.trackIds.add(specTrackId(entry))
  }
  if (view.assembly) {
    into.assemblyNames.add(view.assembly)
  }
  for (const child of view.views ?? []) {
    walk(child, into)
  }
}

// The tracks and assemblies each live ref names on a config this repo holds no
// copy of, keyed by config url. A track the spec declares in `sessionTracks`
// describes itself and is left out.
export function hostedReferences(refs: string[]) {
  const byConfig = new Map<string, HostedReference>()
  for (const ref of refs) {
    const decoded = decodeSpecUrl(ref.startsWith('?') ? `x${ref}` : ref)
    if (!decoded?.config.startsWith('http') || repoConfigPath(decoded.config)) {
      continue
    }
    const entry = byConfig.get(decoded.config) ?? {
      trackIds: new Set<string>(),
      assemblyNames: new Set<string>(),
    }
    for (const view of decoded.spec.views ?? []) {
      walk(view, entry)
    }
    for (const track of decoded.spec.sessionTracks ?? []) {
      entry.trackIds.delete(track.trackId)
    }
    byConfig.set(decoded.config, entry)
  }
  return byConfig
}
