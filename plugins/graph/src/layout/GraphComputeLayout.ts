import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'

import type { Graph, LayoutResult } from '../types.ts'

export interface GraphComputeLayoutArgs {
  sessionId: string
  graph: { nodes: Graph['nodes']; edges: Graph['edges'] }
  options: Record<string, unknown>
  layoutUrl?: string
  statusCallback?: (message: string) => void
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GraphComputeLayout: {
      args: GraphComputeLayoutArgs
      return: { result: LayoutResult; duration: number }
    }
  }
}

interface BandageModule {
  computeLayout(
    graph: { nodes: Graph['nodes']; edges: Graph['edges'] },
    options: Record<string, unknown>,
  ): LayoutResult
}

const DEFAULT_LAYOUT_URL = 'https://jbrowse.org/demos/bandage'

// Lazily initialized WASM module, shared across calls within same worker
let layoutModule: BandageModule | null = null
let initPromise: Promise<void> | null = null
let lastBaseUrl = ''

async function ensureModule(baseUrl: string) {
  if (layoutModule && lastBaseUrl === baseUrl) {
    return
  }

  // Reset if URL changed
  if (lastBaseUrl !== baseUrl) {
    layoutModule = null
    initPromise = null
    lastBaseUrl = baseUrl
  }

  if (!initPromise) {
    initPromise = (async () => {
      const jsUrl = `${baseUrl}/bandage-layout.js`
      const wasmUrl = `${baseUrl}/bandage-layout.wasm`

      const mod = await import(/* webpackIgnore: true */ jsUrl)
      layoutModule = await mod.default({
        locateFile: () => wasmUrl,
      })
    })().catch(e => {
      initPromise = null
      throw e
    })
  }
  await initPromise
}

export default class GraphComputeLayout extends RpcMethodType {
  name = 'GraphComputeLayout'

  async execute(args: GraphComputeLayoutArgs) {
    const { graph, options, layoutUrl, statusCallback } = args
    const baseUrl = (layoutUrl || DEFAULT_LAYOUT_URL).replace(/\/$/, '')

    statusCallback?.('Downloading layout engine')
    await ensureModule(baseUrl)

    statusCallback?.('Computing layout')
    const startTime = performance.now()
    const result = layoutModule!.computeLayout(graph, options)
    const duration = performance.now() - startTime

    return { result, duration }
  }
}
