---
name: every-color-object-takes-breaks-and-a-missing-label
description: The mark display's color object has `breaks` (the values a categorical key lists, in order) and `missingLabel` (the key's row for a feature with no value); the other displays' color objects do not. Adding them is additive and can follow 5.0.0, so the call is which keys would read them.
---

# Every color object takes `breaks` and a missing label

The mark display's `color` declares `breaks`, the values its categorical key
lists and their order, and `missingLabel`, the key's name for a feature with
nothing in `field` (`markColorConfigSchema.ts`). The source's rule is that the
two join another color object only where its key would read them; the
alignments, canvas, variant and MAF color objects declare neither, so a config
spelling them there is refused as an undeclared key.

Adding them is additive: no slot path moves, so it can land after the 5.0.0
freeze (ADR-120). The call is which displays' keys want them.
