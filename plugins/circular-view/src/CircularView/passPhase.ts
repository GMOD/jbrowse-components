import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

export function passPhase(pass: {
  renderError: unknown
  painted: boolean
}): DisplayStatusPhase {
  return pass.renderError ? 'error' : pass.painted ? 'ready' : 'loading'
}
