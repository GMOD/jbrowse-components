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

import { configSchemaFactory, stateModelFactory } from './model.ts'
import { WebGLPileupRendering } from './WebGLPileupRendering.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export { WebGLRenderer } from './WebGLRenderer.ts'
export type { FeatureData, RenderState } from './WebGLRenderer.ts'

export { WebGLPileupRendering } from './WebGLPileupRendering.tsx'
export type {
  WebGLPileupRenderingHandle,
  WebGLPileupRenderingProps,
} from './WebGLPileupRendering.tsx'

export { ColorScheme, configSchemaFactory, stateModelFactory } from './model.ts'
export type { WebGLPileupDisplayModel } from './model.ts'

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
export function registerWebGLPileupDisplay(pluginManager: PluginManager) {
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
