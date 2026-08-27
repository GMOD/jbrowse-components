---
name: re-render-the-five-figures-the-settings-menu-refactor-outran
description: probably already done — verify before spending the pipeline; all five were re-shot after the refactor, and what is left is a review of the three whose verdicts predate the re-shoot
metadata:
  area: figures, synteny
  category: ready
  order: 4
  first_move: "probably already done — verify before spending the pipeline; three need a review, not a capture"
---

# Re-render the five figures the settings-menu refactor outran

**Read this before running anything: the re-render this entry asks for appears
to have happened, and the entry's premise no longer holds.** Checked
2026-08-26 against `5bc6d419c8`:

- `figures.lock` was NOT left partway through the refactor. `d567477154`
  (2026-08-24) rewrote it wholesale — "221 figures and 60 media files
  regenerated" — and it is the commit that introduced the current hash of all
  five. The refactor finished on 2026-08-21 (`c6187c0841`), so every one of the
  five was re-shot against the post-refactor menu.
- `genomes_synteny/ribbons_default` does not box rows that have since moved. Its
  spec was rewritten by the refactor itself (`d2b71b3a48`, 2026-08-20) and its
  boxes anchor by text — `{ type: 'box', anchor: { text: 'CIGAR indels' } }` —
  so they follow the row wherever arity put it. The spec's own comment now
  describes the post-refactor shape ("both rows the section asks the reader to
  change are in it, one under the other").
- `hg002_haplotypes_location_markers` has been re-checked, not merely
  re-rendered: `viewportHeight` is 500 with a comment recording that at 445 the
  annotation landed 0.42px past the frame.

What is genuinely left is **a review, not a capture**. Three of the five carry a
`screenshot-review.json` verdict older than the 08-24 re-shoot, so nobody has
looked at the current picture:

| figure | reviewed | re-shot |
| --- | --- | --- |
| `tracklabels` | 2026-06-15 | 2026-08-24 |
| `genomes_synteny/ribbons_default` | 2026-07-25 | 2026-08-24 |
| `hg002_haplotypes_location_markers` | 2026-08-16 | 2026-08-24 |
| `genomes_synteny/ribbon_settings` | 2026-08-24 | 2026-08-24 |
| `bigwig/whole_genome_coverage` | 2026-08-24 | 2026-08-24 |

So: open the three, confirm the menu in them is the current one, and either
record the verdict or re-render just what fails. Close this entry with that.

The one claim worth keeping is the general one — **nothing in the lock can catch
this class**, because it hashes the bytes in S3 rather than whether the UI still
looks like them. That is what let this entry sit for four days after the work it
describes had already been done, and it is why the review dates above are the
thing to read rather than the lock.
