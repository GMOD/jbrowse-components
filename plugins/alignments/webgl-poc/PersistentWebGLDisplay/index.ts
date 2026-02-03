/**
 * PersistentWebGLDisplay - WebGL-based pileup display with instant zoom/pan
 *
 * This module provides a WebGL-accelerated pileup display that achieves
 * smooth zoom/pan by:
 *
 * 1. Uploading feature data to GPU buffers ONCE when data changes
 * 2. On zoom/pan, ONLY updating shader uniforms (domainX, rangeY)
 * 3. GPU re-renders with new transform in <1ms
 *
 * Key differences from standard JBrowse displays:
 * - Does NOT use ServerSideRenderedBlock (no worker-based rendering)
 * - Manages its own persistent WebGL canvas
 * - Direct event handling bypasses mobx for instant visual response
 * - Mobx reactions still handle data fetching (with debounce)
 *
 * Files:
 * - WebGLRenderer.ts: Core WebGL rendering engine
 * - WebGLPileupRendering.tsx: React component with direct interaction
 * - model.ts: MST model for JBrowse integration
 * - demo.html: Standalone demo for testing
 */

export { WebGLRenderer } from './WebGLRenderer'
export type { FeatureData, RenderState } from './WebGLRenderer'

export { WebGLPileupRendering } from './WebGLPileupRendering'
export type {
  WebGLPileupRenderingProps,
  WebGLPileupRenderingHandle,
} from './WebGLPileupRendering'

export { stateModelFactory, configSchemaFactory, ColorScheme } from './model'
export type { WebGLPileupDisplayModel } from './model'

/**
 * Register the WebGL pileup display with JBrowse
 *
 * Usage in plugin index.ts:
 *
 * ```typescript
 * import Plugin from '@jbrowse/core/Plugin'
 * import { registerWebGLPileupDisplay } from './webgl-poc/PersistentWebGLDisplay'
 *
 * export default class AlignmentsPlugin extends Plugin {
 *   install(pluginManager: PluginManager) {
 *     registerWebGLPileupDisplay(pluginManager)
 *     // ... other registrations
 *   }
 * }
 * ```
 */
export function registerWebGLPileupDisplay(pluginManager: any) {
  const { stateModelFactory, configSchemaFactory } = require('./model')
  const { WebGLPileupRendering } = require('./WebGLPileupRendering')

  const configSchema = configSchemaFactory(pluginManager)
  const stateModel = stateModelFactory(pluginManager, configSchema)

  pluginManager.addDisplayType(() => ({
    name: 'WebGLPileupDisplay',
    displayName: 'WebGL Pileup Display',
    configSchema,
    stateModel,
    trackType: 'AlignmentsTrack',
    viewType: 'LinearGenomeView',
    ReactComponent: WebGLPileupRendering,
  }))
}
