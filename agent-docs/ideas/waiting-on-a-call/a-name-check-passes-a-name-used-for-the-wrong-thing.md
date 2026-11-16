---
name: a-name-check-passes-a-name-used-for-the-wrong-thing
description: check-decision-tree-names proves each name a decision tree uses exists in the code, not that the tree uses it correctly, and it can fail a getter sharing a retired slot's name. Generating the tree's tables from code, as FIT_LADDER does, closes both.
---

# A name check passes a name used for the wrong thing

`website/scripts/check-decision-tree-names.ts` (run by `scripts/check-docs.ts`)
resolves each backticked name in an `agent-docs/reference/*_DECISION_TREE.md`,
and each code-like word in a diagram one embeds, against the config schema's
live slots and the words in product source. A name that resolves passes.

That leaves two gaps:

- **A live name used for the wrong thing passes.** A tree that names a real
  color category, slot or function, but says it does something the code doesn't,
  resolves like a correct one. Only a check on order or meaning catches it.
- **A getter that shares a retired slot's name fails.** A name the schema lists
  only as a retired slot is an error, since a tree describes what the code does
  now. A tree that means a live getter of the same name would be flagged.
  `featureHeight` in `reference/LINEAR_ALIGNMENTS_DISPLAY.md` is such a name,
  and that file is outside the check's scope today, so nothing has tripped yet.
  The workaround is a `NAMED_ON_PURPOSE` entry pinned to its line.

## The fix, where it pays

Generate the part of a tree that can drift from a constant in code, as
`plugins/features/src/LinearBasicDisplay/fitLadderOrder.ts` (`FIT_LADDER`) and
`generateFitLadderDocs.ts` do for the fit ladder's rung table and its `.dot`
chain. A generated block can't name a rung in the wrong order, which the name
check can't see.

## The call

Which trees have an ordered list or ladder in code worth exporting as a
constant, and which stay prose with the name check as their only guard. The
read-color precedence in `ALIGNMENTS_DECISION_TREE.md` and the representative
transcript ranking are the likely next candidates.
