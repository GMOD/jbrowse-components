# @jbrowse/display-kit

Rules and their why: `agent-docs/reference/DISPLAY_KIT.md`. Composition and
fetch rules a display must not break: `agent-docs/reference/DISPLAY_PIPELINE.md`
("What not to do").

- **Put a test needing a real linear genome view in
  `plugins/linear-genome-view/src/displayKitTests/`** — this package sits below
  that plugin.
- **A test wanting a fetch drives the installed autorun and waits for its RPC**
  (`LDDisplay/testEnv.ts`'s `awaitFetch`); a single-shot fetch entry beside it
  drifts from the installed gates. Gate behaviour is
  `installGlobalFetchAutorun.test.ts`'s.
