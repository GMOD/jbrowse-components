---
name: send-the-cram-wasm-to-its-pool-workers
description: "A CRAM track downloads @gmod/cram's htscodecs wasm twice, inlined and again inside the slice worker's source, about 55 KB gzipped of duplicate. The host can send the bytes in the pool's init message; bgzf-filehandle declined the same at 18 KB."
---

# Send the CRAM wasm to its pool workers

A CRAM page fetches two cram-js chunks: the library with htscodecs inlined
(94 KB gzipped, chunk `90005` in a 2026-11-19 build) and
`cram-worker-source.js` (87 KB gzipped), a whole worker as a string that
carries the decoder and the wasm again. cram-js's own `docs/wasm.md` names the
second copy; the pool is on by default in a browser, so jbrowse pays both.

## The change, in cram-js

The design was reviewed twice for the identical bgzf-filehandle duplicate.

- The host posts the wasm **bytes**, not a compiled `WebAssembly.Module`, in
  `init`, copied rather than transferred since the host caches them. A Module
  that fails to clone throws inside `init` and the pool silently gives up.
- The worker bundle is built from a wrapper that imports only the emscripten
  glue, not the inlined binary.
- Await the bytes before constructing any worker, and bail if the pool was
  destroyed meanwhile: a rejection after construction leaks the workers.

## Tests it needs

- Boot, idle-reap, boot again: a detached cached buffer would turn every later
  spawn into a `DataCloneError` and the pool off for good.
- A `decompress` before `init` answers as a worker fault (no batch id), so it
  falls back rather than rejecting the read.
- The shipped worker source boots with the bytes from the shipped inlined
  bundle, since the two must come from one build. A custom `workerUrl` from
  another build fails to link; document that.

## Why bgzf-filehandle declined it

At about 18.5 KB gzipped (15.9 KB brotli), off the first-paint path and in a
wasm-rebuild-sensitive repo, the coupling outweighed the saving. CRAM's
duplicate is three times that. Whether the worker source is on the path to a CRAM
track's first draw, or arrives while the first slices decode in-process, is
unmeasured.
Measure with `measure-web-bundle --worker` on a page with a CRAM track before
and after.
