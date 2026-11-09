Without `makeWorkerInstance`, data is fetched and parsed on the main thread;
rendering stays there either way. `?worker` is Vite's suffix for a worker entry
point, and on Vite 6 and 7 its chunks need `worker: { format: 'es' }`. On
webpack, pass `@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance`.
