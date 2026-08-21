import { namesTemporaryAssembly } from '@jbrowse/core/util'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

/**
 * Dev-only check that a track config being written into a session or config list
 * is one something can still draw tomorrow. No-op in production.
 *
 * A config naming nothing but a temporary assembly is dead the moment its view
 * closes, and no list outside that view has anyone to sweep it — which is the
 * whole of ADR-084. A track only one view can draw carries its config on the
 * track instead (`showTrackGeneric`'s `inlineConf`), so reaching a session list
 * with one is the mistake, not the cleanup afterwards.
 *
 * **This reports a write, not a click.** The two flows a user can drive into it
 * are answered before they get here — the track menu greys its copy actions, and
 * `addTrackFromWidget` opens the track inline instead of adding it — so what
 * survives to report is a caller that had `inlineConf` available and did not
 * take it. That is the reading the message is written for.
 *
 * `console.error` and never `throw`, matching `assertDisplayContract`: these
 * writes happen inside launchers and menu handlers where an exception is caught
 * and reported as a failed track, which would hide the violation. The jest gate
 * (`config/jest/contractGate.js`) is what listens.
 */
export function assertTrackConfOutlivesItsAssemblies(
  session: unknown,
  trackConf: AnyConfigurationModel | Record<string, unknown>,
  destination: string,
) {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  if (!namesTemporaryAssembly(session, trackConf)) {
    return
  }
  const { trackId } = trackConf as { trackId?: string }
  console.error(
    `[jbrowse session contract] ${destination} was given "${trackId}", ` +
      `which names a temporary assembly — one a comparative view synthesized ` +
      `and gives back when it closes, so this config outlives the only ` +
      `assembly that could draw it and nothing sweeps the list it landed in. ` +
      `A track only one view can draw passes its config to that view's ` +
      `showTrack as \`inlineConf\` instead, which puts it on the track and ` +
      `takes it out with the view. See ADR-084.`,
  )
}
