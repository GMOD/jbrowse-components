// The live links on a ```json addtrack fence whose meta names a hosted config
// (`config=<url>`, the same opt-in a session fence uses) or a locus (`loc=`,
// which opens the default config of the track's first assembly): JBrowse Web on
// that config with the fence's track added as a session track and shown, and
// the same link wrapped for Desktop. Without `loc=` the view opens on the whole
// genome, as a spec without `loc` does.

import { toProtocolUrl } from '../../../products/jbrowse-desktop/electron/launchTarget.ts'
import { CODE_BASE } from './code-base.ts'
import { defaultConfigUrl } from './default-configs.ts'
import { configFileUris } from './derive-desktop-steps.ts'
import { sessionConfigUrl } from './derive-session-url.ts'
import { withSessionName } from './spec-recipe/recipe.ts'

export function trackLocation(meta: string | null | undefined) {
  return /(^|\s)loc=(\S+)/.exec(meta ?? '')?.[2]
}

export function trackConfigUrl(
  meta: string | null | undefined,
  assembly: string,
) {
  return (
    sessionConfigUrl(meta) ??
    (trackLocation(meta) ? defaultConfigUrl(assembly) : undefined)
  )
}

export type TrackLinks =
  | { webUrl: string; desktopUrl: string }
  | { refusal: string }

export function deriveTrackLinks(
  config: Record<string, unknown>,
  meta: string | null | undefined,
): TrackLinks | undefined {
  const loc = trackLocation(meta)
  if (sessionConfigUrl(meta) === undefined && loc === undefined) {
    return undefined
  }
  const { trackId, name, assemblyNames } = config
  const assembly = Array.isArray(assemblyNames) ? assemblyNames[0] : undefined
  if (typeof trackId !== 'string' || typeof assembly !== 'string') {
    return { refusal: 'needs a trackId and assemblyNames for its live link' }
  }
  const configUrl = trackConfigUrl(meta, assembly)
  if (configUrl === undefined) {
    return {
      refusal: `carries loc= but assembly "${assembly}" has no default config; add config=<url> of a hosted config that defines it`,
    }
  }
  const relative = configFileUris(config).filter(
    uri => !/^https?:\/\//.test(uri),
  )
  if (relative.length > 0) {
    return {
      refusal: `has a live link but names a file by a non-URL path (${relative.join(', ')}), which a session track resolves against the page; use absolute URLs or drop config= and loc=`,
    }
  }
  const spec = {
    sessionTracks: [config],
    views: [
      {
        type: 'LinearGenomeView',
        assembly,
        ...(loc ? { loc } : {}),
        tracks: [trackId],
      },
    ],
  }
  const webUrl = withSessionName(
    `${CODE_BASE}?config=${encodeURIComponent(configUrl)}&session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
    typeof name === 'string' ? name : trackId,
  )
  return { webUrl, desktopUrl: toProtocolUrl(webUrl) }
}
