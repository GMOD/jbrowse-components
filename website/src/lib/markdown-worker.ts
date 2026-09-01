import { parentPort, workerData } from 'node:worker_threads'

import { createRenderMarkdown } from './markdown-core.ts'

import type { AutogenDoc } from './autogen-links.ts'

const port = parentPort
if (!port) {
  throw new Error('markdown-worker.ts is a worker entrypoint')
}

const render = createRenderMarkdown(
  workerData as { baseUrl: string; docs: AutogenDoc[] },
)

port.on('message', ({ id, body }: { id: string; body: string }) => {
  render(body, id)
    .then(rendered => {
      port.postMessage({ id, rendered })
    })
    .catch((error: unknown) => {
      port.postMessage({ id, error: String(error) })
    })
})
