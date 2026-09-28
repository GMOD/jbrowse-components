---
name: linked-reads-slot-is-the-unit
description: The alignments display's observation unit — a read or a chain — is spelled `linkedReads: 'off' | 'normal'` in config and `isChainMode` in code, beside the RPC's `facet.unit`. A `unit: 'read' | 'chain'` slot would state it directly; it waits on Colin because it renames a config slot.
---

# The `linkedReads` slot is the observation unit

[ADR-188](../../architecture-decision-records/adr-188-the-worker-knows-no-chains.md)
made the chain the unit a facet partitions, and the RPC spells it
`facet.unit: 'read' | 'chain'`. The display still spells the same choice two
other ways:

- **the `linkedReads` config slot**, `'off' | 'normal'`, whose values name
  neither a read nor a chain. It is in track configs, session specs, the
  website's figure specs and `@jbrowse/img`'s `--linkedReads` option.
- **`isChainMode`**, read at about seventy sites across the display, its menus
  and its renderers.

The proposal is a `unit: 'read' | 'chain'` slot, with `isChainMode` becoming a
read of it.

**Why it waits.** Renaming a config slot is a user-facing spelling, and Colin
kept it out of the facet rename to decide on its own. The slot first shipped
in v5.0.0-beta.1 (no v4.3.0 source names it, and JBrowseR carries it only in
its bundled copy of JBrowse), so the rename takes no migration; its writers are
this repo's configs, specs and `@jbrowse/img`.
