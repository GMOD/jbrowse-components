---
name: screenshot-callout-anchoring
description: The screenshot-callout anchoring pass is done and unrendered — what changed in 20 specs, which figures the next sweep will move and by how much, which 40 raw coordinates are deliberate, and what is still unverified. Read before reviewing the sweep that renders these or before touching the residue.
---

# Screenshot callout anchoring — converted, not yet rendered

The audit that opened this thread found **87 hand-placed viewport coordinates
across 38 specs**, against a rule `website/CLAUDE.md` states twice. It is now
**40 across 22 specs**, all deliberate, and
`website/scripts/check-specs.ts` ratchets the count in `pnpm check-docs` so
number 41 fails.

Landed in four commits: the targeted actions, the trio crossover callouts,
the arrow tails, and the ratchet.

The method — how an anchor resolves, the four things about that the types don't
say, and how to convert a coordinate by measuring the committed PNG instead of
re-rendering — is now
[reference/SCREENSHOT_CALLOUT_ANCHORS.md](../reference/SCREENSHOT_CALLOUT_ANCHORS.md).
Read that, not this, to place or convert a callout.

## What the next sweep has to look at

**No figure was regenerated** (the worktree carries another agent's in-flight
display edits, so a render here bakes their unlanded work into a committed PNG).
Twenty specs changed. Most are placement-identical to the pixel by construction;
these are the ones where the geometry deliberately moved, and what to expect:

| figure | what moved | why |
| --- | --- | --- |
| `trio-crossover-paternal` / `-maternal` | the frames' OUTER edges, 3px left and 5px right | they were inset from the view; they are now the window's own. Everything else — the rows, the pitch, the abutment at the crossover — is unchanged arithmetic |
| `lgv_usage_guide` | pills and tails, ≤1px | the lift is 59px off the controls' resolved row (y=121.4) rather than y=62 on the page |
| `bookmark_widget_edit_label` | arrowhead, ~8px left and 1px down | it points at the label cell's centre plus a nudge, where it used to be a raw point |
| `linear_align_ctx_menu` | arrowhead ~5px right, pill ≤2px | head and pill now share the click's own anchor |
| `customized_feature_details` / `upstream_downstream_details` | the click, from x=430 to the Apple3 mRNA's midpoint | same feature, same row, furthest point from either end of it |

Everything else (`multisv` ×3, `read_vs_ref_insertion`, `maf_codon_tooltip`,
`genomes_synteny/launch_sequence`, `gc_content`, `variant_panel`,
`add_track_form`, `drawer_widget_toggle`, `inverted_duplication`) resolves to
the same point it did, within a pixel or two of rounding.

`--check` (renders twice, commits nothing) passes at 0.000% on thirteen of them
— `linear_align_ctx_menu`, `customized_feature_details`,
`upstream_downstream_details`, `lgv_usage_guide`, `variant_panel`, `gc_content`,
`read_vs_ref_insertion`, `add_track_form`, `drawer_widget_toggle`,
`bookmark_widget_edit_label`, `trio-crossover-paternal`,
`trio-crossover-maternal`, and `maf_codon_tooltip` at 0.001%. A clean run is the
proof every anchor resolved: `drawAnnotations` throws on one that doesn't, an
action anchor fails the spec by name, and three of these gate on what the click
produced — `read_vs_ref_insertion` drives a five-step launch chain off its
right-click, `maf_codon_tooltip` declares `expectTooltip`, so a hover into a gap
between rows would have been reported.

**Not verified, and the one thing left to do here:** `multisv`, `multisv_svtype`,
`multisv_rhd`, `genomes_synteny/launch_sequence`, `inverted_duplication`. All
five are minutes-long remote renders. Their anchors are the same shapes as the
verified ones, and the two riskiest bits are the launch sequence's `dy: 4` (the
chain-block row is the top ~7px of its display) and `multisv_rhd`'s clustering
gate, which is unrelated to this change.

## The 40 that stay, and why they are not a backlog

`countRawCallouts` in `screenshot-specs.ts` lists them and its comment gives the
rule. Three kinds:

- **A caption parked in a corner or a margin.** It points at nothing, so the
  failure anchoring prevents cannot happen to it, and anchoring relocates it.
- **The tail of an arrow leaving one of those captions** — `link_to_split_view`,
  `multiway_synteny/ecoli_import_form` ×2, `ecoli_stx_island`,
  `multiwig/addtrack` ×2. The caption and its tail are one unit in page
  coordinates; anchoring only the tail unglues the arrow from its own pill.
  This corrects the earlier claim in this file that all sixteen `arrow from`
  entries convert the same way — the ten that had something at the tail did,
  these six do not.
- **`dismissMenus` (×6) and `gene_track_color_by_cds`'s (700,550)**: they click
  a menu backdrop, which covers the viewport, so they hit nothing on purpose.

If one of the six pill+tail pairs is ever worth converting, the conversion is to
anchor the **pill** to the panel it sits over — as `inverted_duplication` now
does, its three callouts hanging off the pileup track's top edge — and then the
tail follows off the same anchor. That is a composition decision per figure, not
a mechanical pass, which is why it is not queued here.

## Closed with this thread

`sv_cgiab/deletion_sv_inspector_search`'s raised `diffThreshold` came off in the
worked example that started this (`3dbdaa1c08`, `acb06ef36a`): it was raised for
"remote VCF render jitter" that was never measured, and the real drift it was
hiding could not be committed while the callouts were hand-placed. Its
annotations block is still the shortest thing to read before writing one.
