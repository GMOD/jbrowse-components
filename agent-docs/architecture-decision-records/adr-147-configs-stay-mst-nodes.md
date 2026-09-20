---
status: Rejected
summary: "Configs stay MST nodes: a config as plain JSON read against the slot table was built for adapters, tracks and displays, and declined — every gap a review found was closed by rebuilding something MST already provides, and the non-track kinds lose persistence, undo and references by leaving the tree"
---

# ADR-147: Configs stay MST nodes; a plain-document substrate was built and declined

## Status

Rejected (2026-09-20). The experiment is the unlanded branch
`worktree-plain-adapter-config-spike`.

## Context

`setConf` takes the path `getConf` takes, `null` resets a slot (ADR-146), and
three grammar-object writes that misfired are fixed. A review of that write
surface framed its four defects as one: the slot table is the source of truth,
and the MST model and the TypeScript types are two projections of it that can
disagree. The proposal that followed was to drop the MST projection — a config
becomes the table plus the JSON already stored in `jbrowse.tracks`, read through
an object that owns no copy.

## Decision

**A config is an MST node.** We keep `ConfigurationSchema()` building an MST
model, and we keep the non-track kinds in the tree.

## What the experiment showed

The branch put adapters, tracks and displays on plain documents and passed 1,994
of 1,996 non-web suites. Each review then found a property the documents had
lost, and each fix rebuilt a piece of MST by hand:

- a MobX `computed` per slot per config, for the per-property observability a
  node has;
- a pass that hands back unchanged subtrees after every write, for MST's
  structurally shared snapshots;
- sub-configs found by `displayId`, for identifier reconciliation;
- a normalizer running `preProcessSnapshot`, union dispatch, defaults and
  `stripDefault`, reading MST's private `_subtype` and `determineType` to see how
  a schema was composed;
- `applyPatch` routed to whichever array holds the JSON, for actions;
- a memo map of config objects per store, for references.

The result was 737 lines of undocumented machinery against the 146-line model
builder it replaces, and the branch stood at +1,431/−173.

Tracks are where a document helps. They already left the tree (ADR-031), and the
throwaway node, the two 400 ms savers and the working copies (ADR-032) exist
because a node is a copy that has to be kept in step. An object that owns no copy
needs none of them, and both undo tests passed with no invalidation step.

Assemblies, connections, internet accounts and the root config are in-tree nodes:
two lines of declaration each, with persistence, undo and references from MST.
Moving them out gives each the problems tracks have. Moving only tracks leaves
two kinds of `configuration` object in production, and every helper handling
both.

## What a re-try has to answer

A silent no-op is the failure to expect. On the branch, a setting toggled on a
reference sequence track did nothing: the write went to the track list, and a
sequence track is the `sequence` of its assembly. 22,388 passing tests did not
drive it. `ReferenceSequenceSettingSaved.test.ts` drives it now.
