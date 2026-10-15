---
name: write-uniforms-as-loops-above-sixteen-elements
description: The writeUniforms emitter unrolls every uniform element into its own assignment, so linkMark.iface.generated.ts holds about 1,650 of them. Emitting a loop above about 16 elements saves roughly 11 KB gz on a page with an alignments track and 9 KB with a plugin named, and a microbench shows the loop no slower. Measured 2026-10-08.
---

# Write uniforms as loops above sixteen elements

- The emitter is `writeUniforms` in `packages/shader-tools/src/shader-codegen/`.
- Loop above about 16 elements, so `codegen.test.ts` still passes.
- A microbench puts the loop at 2.5 µs per call against 3.0 µs unrolled.
- Check `pnpm gen:shaders`'s exit code: a failed compile leaves the stale
  `.generated.ts` passing.
