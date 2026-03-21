// @ts-nocheck -- Emscripten glue code is untyped
import createBandageLayoutModule from './bandage-layout.js'

let layoutModule: ReturnType<typeof createBandageLayoutModule> | null = null

async function initialize() {
  if (layoutModule) {
    return
  }
  layoutModule = await createBandageLayoutModule()
  self.postMessage({ type: 'init-complete', success: true })
}

self.onmessage = async function (e: MessageEvent) {
  const { type, id, data } = e.data

  if (type === 'compute-layout') {
    if (!layoutModule) {
      self.postMessage({
        type: 'layout-result',
        id,
        success: false,
        error: 'Worker not initialized',
      })
      return
    }

    self.postMessage({
      type: 'layout-progress',
      id,
      progress: 0,
      stage: 'Starting layout computation',
    })

    const startTime = performance.now()
    const result = layoutModule.computeLayout(data.graph, data.options)
    const duration = performance.now() - startTime

    self.postMessage({
      type: 'layout-result',
      id,
      success: true,
      result,
      duration,
    })
  } else if (type === 'terminate') {
    self.close()
  }
}

initialize()
