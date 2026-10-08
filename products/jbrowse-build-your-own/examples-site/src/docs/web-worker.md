`?worker` is Vite's suffix for bundling a module as a worker entry point. The
RPC worker code-splits, so set `vite: { worker: { format: 'es' } }`. On webpack,
pass the prebuilt `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`
instead. Fetching, parsing and layout move to the worker; rendering stays on the
main thread.
