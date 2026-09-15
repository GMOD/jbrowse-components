Under webpack, import
`@jbrowse/react-linear-genome-view2/esm/makeWorkerInstance` instead of the
`?worker` entry, and set `output.publicPath: 'auto'` so the worker finds its own
URL. A module worker, which Vite builds here, cannot load a UMD plugin; a
classic worker can.
