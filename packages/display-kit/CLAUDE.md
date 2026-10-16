# @jbrowse/display-kit

Rules and their why: `agent-docs/reference/DISPLAY_KIT.md`. Composition and
fetch rules a display must not break: `agent-docs/ARCHITECTURE.md` ("What not to
do").

- Tests needing a real linear genome view live in
  `plugins/linear-genome-view/src/displayKitTests/`, since this package sits
  below that plugin.
- **The fetch sequence lives in core** (`@jbrowse/core/util/installFetch`);
  `installGlobalFetchAutorun` only declares gates over it. A test wanting a
  fetch drives the installed autorun and waits for its RPC
  (`LDDisplay/testEnv.ts`'s `awaitFetch`); gate behaviour is
  `installGlobalFetchAutorun.test.ts`'s. Don't add a single-shot entry beside it
  — the last one drifted from the installed gates.
