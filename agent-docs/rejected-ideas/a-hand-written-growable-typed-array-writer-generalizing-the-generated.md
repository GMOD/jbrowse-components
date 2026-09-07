---
name: a-hand-written-growable-typed-array-writer-generalizing-the-generated
description: A hand-written growable-typed-array writer, generalizing the generated `InstanceWriter`
area: tooling-tests-and-docs
---

# A hand-written growable-typed-array writer, generalizing the generated `InstanceWriter`

costed 2026-08-13 and declined for want of a second
consumer. The generated writer serves the two encoders whose output is one
interleaved buffer with a shader-reflected stride (`mafInstanceBuffer.ts`,
`multiRowInstanceBuffer.ts`); no codegen can reach a writer over *parallel*
arrays, so the question is whether a plain utility is worth it. Exactly one
site in the tree has that shape — `MismatchWriter` in `computeMafCoverage.ts`,
doubling `Uint32Array` positions alongside `Uint8Array` bases, with the same
right-sized-copy `finish`. `IdentityColumns` in `drawRowIdentity.ts` reads like
a third and is not one: its bound is `refBytes.length`, known before the loop,
so it sizes once and reuses across blocks rather than doubling — its own
comment claimed the kinship and has been corrected. One consumer, no shared
drift hazard, and the generic version would have to be parameterized over both
element types and the arity.
**The general form:** "the same shape appears N times" is a claim about the
growth policy, not about the field list. Check whether the bound is known
before the loop before counting a site.
