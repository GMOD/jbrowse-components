---
name: jb-setsession-blames-the-document-for-a-bad-live-value
description: In a production build, `jb.setSession` refuses every document once the live session holds a wrongly typed value, and the refusal blames the document, because the merged-snapshot typecheck it runs first is the only check left once production MST skips write checks.
---

# `jb.setSession` blames the document for a bad live value

`setSession` in `packages/app-core/src/JbApi/jbApi.ts` runs
`typecheck(getType(session), next)` on the merged snapshot before it applies
it. Production MST skips the write checks that would have kept a wrongly typed
value out of the live session, so once one is there, every document merges into
a snapshot that fails the typecheck, and the error names the document.

Fix: when the typecheck fails, typecheck the live session's own snapshot against
the same type. If that fails too, report that the live session is invalid, not
the document.

Found by an audit of `products/jbrowse-desktop/electron/mcp/`,
`products/jbrowse-desktop/src/mcp/` and `packages/app-core/src/JbApi/`.
