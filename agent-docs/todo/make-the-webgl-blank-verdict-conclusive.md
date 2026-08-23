---
name: make-the-webgl-blank-verdict-conclusive
description: `--real-gpu` already discriminates; decide whether the override is still worth a run
metadata:
  area: browser tests
  category: ready
---

# Make the webgl blank verdict conclusive

Half the blank captures are unattributable, and the self-report now says which
half it is in rather than reading as agreement: `canvasSelfReport`
(`products/jbrowse-web/browser-tests/snapshot.ts:332-385`) probes
`getContextAttributes().preserveDrawingBuffer` and, on a volatile buffer, states
outright that a blank readback "says NOTHING about which side failed" and to
re-run that one test with `--real-gpu` (`runner.ts:83`) — a SwiftShader
compositing blank does not survive it, a render one does. That is `29f47a637d`,
and it is the readable half done.

The diagnostic itself still does not exist: nothing overrides `getContext`
through `evaluateOnNewDocument` to turn `preserveDrawingBuffer` on, and
[CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md):105-113 records it open
as a diagnostic while refuting it as a *fix*. **This is one deliberate run, not
another A/B, and it must not be left on.**

**But the cheap discriminator lowers what the run buys.** `--real-gpu` is a real
flag that separates the two sides on the one test that failed, with no build
override and nothing to verify against a plain canvas first — so decide whether
the override is worth doing at all before taking it.
