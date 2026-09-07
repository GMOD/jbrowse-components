---
name: a-preservedrawingbuffer-override-to-make-the-webgl-blank-verdict-conclusive
description: A `preserveDrawingBuffer` override to make the webgl blank verdict conclusive
area: tooling-tests-and-docs
---

# A `preserveDrawingBuffer` override to make the webgl blank verdict conclusive

declined 2026-08-25, because the flag that discriminates
already ships. Half the browser-suite blank captures are unattributable on a
volatile drawing buffer, and `canvasSelfReport`
(`products/jbrowse-web/browser-tests/snapshot.ts`) now says so outright and
names the remedy: re-run that one test with `--real-gpu` (`runner.ts`), which
a SwiftShader compositing blank does not survive and a render one does. The
override would be a `getContext` monkey-patch through
`evaluateOnNewDocument` — a build modification that must not be left on, run
once, verified against a plain canvas first — to answer what a shipped flag
answers with none of that. CROSS_BACKEND_GATE.md already refutes it as a
*fix*; this closes it as a diagnostic too.
