---
name: columnar-typed-array-output-in-place-of-modificationentry
description: Columnar typed-array output in place of `ModificationEntry[]`
area: performance-and-measurement
---

# Columnar typed-array output in place of `ModificationEntry[]`

measured
2026-08-14 and declined at **3.38x against the 4.01x of leaving it alone**,
i.e. a regression of about 15% for a substantially larger change. The premise
looked airtight: nothing survives as an object, since
`buildModificationArrays` filters the array and immediately flattens it into
typed arrays, so the objects exist only to carry values between two loops.
They are also short-lived enough to die in the nursery, while growable typed
columns pay doubling copies and an intern lookup per push. Same bench, kept as
an arm. Don't re-propose it without a fixture where the marks outlive the
fetch.
