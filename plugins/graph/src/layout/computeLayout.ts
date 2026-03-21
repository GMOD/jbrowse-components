import type { Graph, LayoutResult } from '../types.ts'

export interface LayoutOptions {
  quality?: number
  linearLayout?: boolean
  componentSeparation?: number
  aspectRatio?: number
  nodeLengthPerMegabase?: number
  minimumNodeLength?: number
  nodeSegmentLength?: number
  edgeLength?: number
}

export interface LayoutProgress {
  progress: number
  stage: string
}

let messageId = 0

export function computeLayout(
  graph: Graph,
  options: LayoutOptions = {},
  onProgress?: (p: LayoutProgress) => void,
) {
  const worker = new Worker(
    new URL('./layoutWorker.ts', import.meta.url),
  )

  const id = messageId++

  return new Promise<{ result: LayoutResult; duration: number }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.terminate()
        reject(new Error('Layout computation timed out after 60s'))
      }, 60_000)

      function sendComputeRequest() {
        worker.postMessage({
          type: 'compute-layout',
          id,
          data: {
            graph: {
              nodes: graph.nodes,
              edges: graph.edges,
            },
            options: {
              quality: 1,
              linearLayout: false,
              componentSeparation: 15.0,
              aspectRatio: 1.333333,
              nodeLengthPerMegabase: 1000.0,
              minimumNodeLength: 1.0,
              nodeSegmentLength: 1.0,
              edgeLength: 1.0,
              ...options,
            },
          },
        })
      }

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data

        if (msg.type === 'init-complete') {
          if (msg.success) {
            sendComputeRequest()
          } else {
            clearTimeout(timeout)
            worker.terminate()
            reject(new Error(`Layout worker init failed: ${msg.error}`))
          }
          return
        }

        if (msg.id !== id) {
          return
        }

        if (msg.type === 'layout-progress') {
          onProgress?.({ progress: msg.progress, stage: msg.stage })
        } else if (msg.type === 'layout-result') {
          clearTimeout(timeout)
          worker.terminate()
          if (msg.success) {
            resolve({ result: msg.result, duration: msg.duration })
          } else {
            reject(new Error(msg.error))
          }
        }
      }

      worker.onerror = (err: ErrorEvent) => {
        clearTimeout(timeout)
        worker.terminate()
        reject(new Error(`Layout worker error: ${err.message}`))
      }
    },
  )
}
