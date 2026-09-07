---
name: a-rolldown-advancedchunks-group-naming-a-chunk-per-third-party
description: A rolldown `advancedChunks` group naming a chunk per third-party package
area: tooling-tests-and-docs
---

# A rolldown `advancedChunks` group naming a chunk per third-party package

,
to decouple the examples sites' page budgets from each other — measured and
reverted. It costs **104 KB a page**: `ultraminimal` 508 -> 645, `index`
560 -> 664, `synteny` 675 -> 771. The reason is the premise. Chunks are
page-dependent *because* rolldown cuts them by usage, and that fine cut is
what keeps a page from downloading a whole package for three components of it;
pin the boundary by package and every page pays for all of `@mui/material`.
The coupling is the price of the optimization, not a defect beside it — don't
retry without a plan for partially-used vendors. See
[EAGER_BUNDLE.md](../reference/EAGER_BUNDLE.md) §"A multi-page site's budgets are coupled".
