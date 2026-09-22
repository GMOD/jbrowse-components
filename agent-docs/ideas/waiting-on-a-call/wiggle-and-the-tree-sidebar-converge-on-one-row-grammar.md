---
name: wiggle-and-the-tree-sidebar-converge-on-one-row-grammar
description: ADR-152's column encoder already measures at wiggle's own speed — the one blocker left is 8 retained bytes a feature, with a named fix — but the mark display still has no tree sidebar, and wiggle is the one display that needs both. Read before proposing either "port wiggle onto the grammar" or "declare the row sidebar" alone; they are one proposal.
---

# Wiggle and the tree sidebar converge on one row grammar

Two gaps that read as separate in
[GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md) turn out to be
one, once a display is named that sits in both: `LinearWiggleDisplay`
(`QuantitativeTrack` and `MultiQuantitativeTrack`, ADR-143) already decides its
row layout through `facet`, the mark grammar's own object, and separately
composes `TreeSidebarMixin` for the dendrogram, clustering, row colour and row
labels the sidebar draws. It is halfway into the grammar on one axis and
entirely outside it on the other. Closing only one axis is half a win.

## What ADR-152 already proved

[ADR-152](../../architecture-decision-records/adr-152-wiggle-stays-off-the-column-encoder-until-two-lanes-go.md)
built the substitution and measured it: an `encodeColumns` reading wiggle's
typed arrays directly, answering the same `EncodedChannels` the mark grammar's
`bar` shape reads. Speed was not the objection — the column encode ran
0.59–0.99x wiggle's own hand packer across fixtures up to 14M rows, and a
`jexl:` channel through a reusable row cursor ran at 0.26–0.40x the
`SimpleFeature` path the mark display would otherwise pay. The one criterion
that fired was retained memory: `EncodedChannels` holds 20 bytes a feature
against wiggle's 12, all eight of them named — four for `featureIndex`, the
identity permutation whenever no step reorders rows, and four for a `color`
lane holding a value wiggle carries once per *source*, broadcast into a
per-instance slot it does not need.

The ADR's own "Revisit if" names the fix: let `EncodedChannels` decline
`featureIndex` when nothing reorders, and let a constant colour ride as a
scalar rather than a lane. Meet both and, in the ADR's words, "the line, the
density band and the whiskers band become shape questions rather than byte
questions" — which also reopens
[ADR-127](../../architecture-decision-records/adr-127-line-stays-wiggles.md)'s
refusal of a `line` shape, whose stated kill was exactly wiggle not yet being a
second consumer of the mark family's channels.

This half is close to `ready/`: the fix is two named lanes, and re-running
`packages/core/benches/columnEncode.bench.ts` after they land is the number
that settles it, not a fresh design.

## What ADR-152 does not answer: is a source a facet or a layer?

`RenderMultiWiggleDataRPC` already answers per source. `facet`, everywhere
else it is used, splits *one* mark's already-fetched features by a field value
into row sections (`facetLayers`,
[GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md) §"The facet
stage") — the facet never decides what got fetched. A multi-wiggle's sources
are not a field on a shared feature set; they are which of N parallel series a
row belongs to, closer to N tracks worth of features than one track split by
an attribute. ADR-152's own "Revisit if" list assumes an answer without
arguing for it — "a multi-wiggle encodes one layer per source, with the row as
a per-layer constant" — which reads as *layer*, not *facet*, but the
consequence of that reading is not spelled out anywhere: each source becomes
its own `marks[]` entry sharing one `scales.y` (which ADR-141's "every drawing
mark folds into it" already gives for free), rather than one mark faceted by a
`source` field. Read `RenderMultiWiggleDataRPC` against `facetLayers` before
building either arm; nothing here settles which one is truer to what already
ships.

## The half nobody has scoped: the tree sidebar is not grammar yet

`TreeSidebarMixin` (`packages/tree-sidebar`) is composed by exactly five
displays: MAF, the two multi-sample variant displays, the canvas multi-row
display, and `LinearWiggleDisplay`. The mark display is not one of them, and
has no dendrogram, no clustering, no draggable row order, no row-colour-by-field
outside its own `facet`/`color` channels.

The row panel table in
[GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md) §"The row
panel, against ggtree and react-msaview" already maps every filled cell of
`TreeSidebarMixin` onto ggtree and react-msaview vocabulary — row order is
`domain`, row colour is `colorBy`, row labels are `showRowLabels`, branch
length is `showBranchLength` — and names the four empty cells (collapsing or
bracketing a clade, node labels, further row panels) as "each a mark or a
guide over the row axis... and none is a new channel." Nobody has taken the
next step the table implies: turning the *filled* cells into declared
vocabulary a faceted mark display could opt into, the way `facet` itself
turned four displays' separate row-splitting mechanisms into one config object
(ADR-130, ADR-131). Today they are mixin surface on five bespoke models, not
config a JSON track definition can name.

This half has no bench and no proposed shape. What the vocabulary would look
like — a `rowGuides` object beside `facet`? slots `facet` itself grows? — is
not designed. It is a call, and the biggest one here.

## Why these are one proposal

Meeting ADR-152's two conditions alone gets wiggle a cheaper encoder and
nothing else: it is still five bespoke `TreeSidebarMixin` compositions plus one
mark-grammar consumer, not a display whose row body *and* row sidebar are both
declared. Wiggle is the right display to prove the unification against
precisely because it already straddles both halves — `facet` decides its
layout today, `TreeSidebarMixin` decides its sidebar today, and nothing else in
the tree sits on both seams already.

## What this is not

- **Not a reason to revisit ADR-114 or ADR-118.** Alignments, variant, feature
  and synteny stay TypeScript on a different axis — a materialised `Feature[]`
  their format-typed layout needs, not a byte-lane question a column encoder
  answers. Wiggle never builds a `Feature` today, which is the whole reason its
  number came out differently.
- **Not a call to merge MAF, the two multi-sample variant displays and
  multi-row into one display type.** `facet` converged row-splitting without
  merging the four displays that use it; a declared row-guide vocabulary would
  converge the sidebar the same way, each display keeping its own model and
  fetch.
- **Not settled enough to build.** The source-as-facet-or-layer question and
  the row-guide vocabulary shape are both open; this doc is the case for why
  they are one question, not an answer to either.

## Work, in order of what is already measured

1. **Land ADR-152's two lane fixes** and re-run `columnEncode.bench.ts`. This
   is close to `ready/` on its own.
2. **Read `RenderMultiWiggleDataRPC` against `facetLayers`** and settle
   source-as-field vs. source-as-layer before writing either arm — a call, but
   a narrow one.
3. **Design the row-guide vocabulary** the row panel table already implies,
   scoped first to the filled cells (`domain`, `colorBy`, `showRowLabels`,
   `showBranchLength`) rather than the four empty ones, which are a later
   proposal once a shape exists to add them to.
4. **Port wiggle first**, since it is the one display that needs both halves
   and can prove the unification without touching MAF or the variant displays
   yet.

See also [row-display-followups](../collections/row-display-followups.md) for
the polish items the same five displays left unbuilt on the sidebar side —
orthogonal to this doc, not a subset of it.
