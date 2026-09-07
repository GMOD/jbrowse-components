---
name: letting-generic-filehandle2-resolve-through-its-browser-entry-to-get
description: Letting `generic-filehandle2` resolve through its browser entry, to get `fs` out of the desktop renderer
area: tooling-tests-and-docs
---

# Letting `generic-filehandle2` resolve through its browser entry, to get `fs` out of the desktop renderer

built both ways 2026-08-16 and declined.
Deleting the alias in `products/jbrowse-desktop/scripts/config.ts` does clear
the renderer's one `require("fs/promises")`, and clears the **worker's** too:
webpack's condition set for `electron-renderer` holds `browser` as well as
`node`, the package declares `"browser"` first in its `exports`, and one
`resolve` config serves both graphs — so both get the stub `LocalFile` that
rejects every read, which is every local file in desktop. `config.target` is
not the lever either. **The alias stays**; the way out is a dynamic
`import()` of `LocalFile` behind the capability check, so the renderer's
graph may contain the node build as long as it never evaluates it. Detail and
the two-build table in
[DESKTOP_CONTEXT_ISOLATION.md](../reference/DESKTOP_CONTEXT_ISOLATION.md).
