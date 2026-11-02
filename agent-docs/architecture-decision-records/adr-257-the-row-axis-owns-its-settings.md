---
status: Accepted
summary: "Everything about a row display's row axis lives under `rows`, as a Vega-Lite channel owns its scale, guide and sort: `rowHeight` is `rows.step` (unset fits the rows to `height`), the sidebar `axis` is `rows.axis`, per-row colors are `rows.colors` (a name map beside `labels`) and the row-attribute color channel `rows.color`, `rowGroups` is `rows.groups`, `rows.kept` is `rows.filter` (a predicate list over the row table), and `rows.tree` holds `{ newick, provenance }`. The variant display's `unit` becomes `rows.field: 'sample' | 'haplotype'`. A new declared write rule makes this safe: on `rows` and `facet`, a write that changes `field` resets the members keyed by the field's values and merges the rest, the members the write states winning. Amends ADR-238 and ADR-231; reverses ADR-194's row-height placement"
---

# ADR-257: The row axis owns its settings

## Status

Accepted (2026-11-02). Colin asked for the best grammar-of-graphics spelling
over a respell he judged on a technical reason ("this seems like a technical
reason over a grammar-of-graphics motivated reason"), with churn and lost
beta compatibility allowed. Seven reviews shaped it: three Fable (a cold read
of the surface, a design read, a naming read) and four Opus (mechanism twice,
grammar, writers).

## Context

- A row display (variant, wiggle, the mark family, MAF) spelled its row axis
  across five top-level slots: `rows` (field and arrangement), `rowHeight`,
  `rowColor`, `rowGroups` and `axis`. Each `row*` compound named a path the
  grammar spells as a member, and `axis` was the row axis's guide sitting apart
  from the axis it guides, while the value axis is `encoding.y.axis`.
- What kept them apart was a write rule, not a grammar reason: `rows` takes a
  string shorthand and every settings bag replaced it whole, so `rows: "source"`
  would have reset anything folded in (ADR-231's reason for declining a
  shorthand on a band object, and the `rowColorConfigSchema` comment). The menu's
  field pick (`rowsForField`) already followed a better rule: reset what is
  keyed by the old field's values, keep the rest.

## Decision

| Before | After | Grammar |
| --- | --- | --- |
| `rowHeight` (`0` = fit) | `rows.step`, unset = fit | Vega-Lite's word for one band's pitch, on the band scale; `height` stays the track, which never sizes itself from its row count |
| `axis { tree, branchLength, labels, width, grid }` | `rows.axis` | a guide nests under its channel, as `encoding.y.axis` does |
| `rowColor` `name` pairs | `rows.colors: { row: css }` | a per-row map beside `labels`, keyed by the row names |
| `rowColor` over an attribute | `rows.color: { field, scale }` | the row-attribute color channel; `encoding.color` stays the value color |
| `rowGroups [{ match, group }]` | `rows.groups` | derives the `group` row attribute (ggplot2's `group`) that `facet` and `rows.color` read |
| `rows.kept` | `rows.filter: [{ field, oneOf, ... }]` | "a predicate drops" (ADR-238): a clade pick writes `{ field: 'name', oneOf }`, and a row attribute can narrow too |
| `rows.tree` + `rows.treeProvenance` | `rows.tree`: newick, or `{ newick, provenance }` | one setting, written whole |
| variant `unit: sample \| haplotype` | variant `rows.field: 'sample' \| 'haplotype'` | what one row is, which `rows.field` exists to say |

`rows`, `rows.field`, `rows.sort`, `rows.labels`, `facet`, `height` and
`encoding` keep their spellings, as does MultiWaySynteny's top-level `axis` (its
lanes' x ruler). Members follow capability: `step` where rows scroll (variant,
the mark family), `groups` on the mark family, and the multi-way lanes' `rows`
takes only `filter` from the list. MAF's `rows` takes no `field`, which would
be a one-value enum there.

One naming rule makes each member predictable: a plural member is a map keyed
by row name (`labels`, `colors`), a singular member is a channel or setting
(`color`, `step`, `filter`, `tree`), and `axis.*` holds the drawing toggles
(`axis.labels`, `axis.tree`). Each same-word pair names its sibling in its
description, and so does the validator's error for a swapped member. There is
no `axis.show`: turning off `axis.tree` and `axis.labels` leaves no sidebar.

- `rows.filter` is a predicate list with no carve-out: one matching no row
  draws no rows and says so, where `kept` naming no current row drew every row.
- A plot read returns `rows.tree` in its object form whichever form was
  written, so a wrapper handles one shape.

### The write rule

`writes` gains a declared form, data so the CLI's manifest carries it:
`{ keyedBy: 'field', keyed: [...] }`, on `rows` and `facet`.

- A write whose `field` differs from the field in effect (the stored one,
  else the schema default, so the variant display's `'sample'` compares as
  stated) first resets the keyed members it does not itself state, then
  merges what it states. Members outside `keyed` merge per member, `null`
  resetting one, and `rows: null` resets the whole object.
- In user docs: writing `rows` changes only the members stated, and `null`
  clears one; a write that changes `field` first clears the arrangement
  (`sort`, `labels`, `colors`, `tree`, `filter`, `groups`) except what it
  states.
- `rows` keys `sort`, `labels`, `colors`, `tree`, `filter` and `groups`;
  `facet` keys `sort` and `hidden`.
- Objects whose members are alternatives (`encoding.color` `value | field |
  datum`, size, opacity) and one-action objects (alignments `sort`) stay
  `writes: 'whole'`; `rows.color` and `rows.tree` are whole.
- One shared helper serves `mergeConfSettings`, `writeConfMember`, the share
  link delta (`trackConfigDelta`) and the CLI's `mergeBySlots`; `rowsForField`
  and `facetForField` become a field write through it.
- A plot read never folds a keyed object to its shorthand, so `plot.rows.step`
  is always reachable; a launch modifier lifts `rows=source` beside a
  `rows.*` member to `{ field }`, and `memberPatch` seeds only whole objects.
- Edit plot's whole write applies the keyed reset when its `field` changes.

## Rejected

| Proposal | Why not |
| --- | --- |
| `rows.height` for the pitch | `height` would mean the track one level up and a row one level down |
| `height: number \| { step, max }` | `{ step }` sizes the view from its row count, which no multi-row display does (reference/ROW_HEIGHT_AND_FIT.md) |
| `rows.domain` for the shown rows | a discrete domain also orders in Vega-Lite and ggplot2, every other `domain` sits under a `scale`, and older ADRs used `rows.domain` for the order |
| Per-row colors as `rows.color.scale` name pairs | the pairs are keyed by the rows field only while `color.field` is `name`, a conditional reset nothing declarative can state |
| `rowGroups` as a `transform` step | the mark display's `transform` runs on feature records; a second meaning for the word |
| The keyed rule on every shorthand object | an object of alternatives would merge `value` over `field` into both |
| `facet.collapse` | `facet` is shared by displays the collapse means nothing on; `pileup.collapsed` (ADR-240's 2026-11-01 amendment) is on the band it reshapes |
| Deprecated lifts for the beta-only keys | beta configs and share links may break (Colin, 2026-11-02); the v4 lifts (`showTree`, `showSidebarLabels`, `colorBy`, `renderingMode`, `liftRetiredRowState`) are retargeted |

## Parked

Found by the reviews, not built here: negation and a regex `match` in the
shared predicate grammar, which would let `rows.filter` hide one row and
`rows.groups` become predicate entries (`{ field, oneOf | match, group }`);
`groups` on the variant display; `rows.sort` by a row attribute; a tree read
from a file (`rows.tree: { uri }`); labels from a row attribute.

## Consequences

- A share link or `displayDefaults` writing `rows: "source"` keeps `step`,
  `axis` and `color`; one restating the field it already has keeps the
  arrangement, where it used to clear it.
- Beta share links lose `rowHeight`, `rowColor`, `rowGroups`, `axis` and
  `rows.kept` with a console notice; jb2hubs' hosted displays lose row colors
  and grid on a beta host older than the respell.
- Same-word pairs inside one object (`rows.labels` map and `rows.axis.labels`
  boolean, `rows.tree` and `rows.axis.tree`) name each other in their
  descriptions.
- ggjbrowse boxes only character vectors and gains a `jbrowse_rows()` helper.

## Order of work

1. The keyed write rule in core, with its CLI and delta copies, the plot read
   and launch-args fixes; adversarially reviewed before it lands.
2. `facet` takes the rule.
3. The `rows` fold on wiggle, MAF and the mark family, `rows.filter` on the
   multi-way lanes too; after the mark-family session in flight lands.
4. The variant display, `unit` included, after the variant merge lands.
5. Writers: menus, launch-args, jbrowse-img, the tables and R export, figure
   specs, tutorials, jb2hubs, ggjbrowse.
