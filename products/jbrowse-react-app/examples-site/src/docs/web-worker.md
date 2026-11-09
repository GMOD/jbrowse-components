Without `makeWorkerInstance`, data is fetched and parsed on the main thread. On
Vite 6 and 7 the worker's chunks need `worker: { format: 'es' }`. Under webpack,
import `@jbrowse/react-app2/esm/makeWorkerInstance` instead of the `?worker`
entry, and set `output.publicPath: 'auto'` so the worker finds its own URL.
