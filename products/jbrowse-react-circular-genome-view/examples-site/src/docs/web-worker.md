Under webpack, import
`@jbrowse/react-circular-genome-view2/esm/makeWorkerInstance` instead of the
`?worker` entry, and set `output.publicPath: 'auto'` so the worker finds its own
URL. Vite needs `worker: { format: 'es' }`, because the worker splits into
chunks.
