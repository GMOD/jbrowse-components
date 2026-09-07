---
name: deleting-the-constant-entry-feature
description: Deleting the constant-entry feature
area: config-and-mst
---

# Deleting the constant-entry feature

(`isConstantEntry` →
`volatileConstants` → `.volatile()` in `makeConfigurationSchemaModel`, and the
`string | number` members of `ConfigurationSchemaDefinition`) — measured
2026-08-15 and declined. It really is unused: **0 constant entries across all
93 registered schemas**, read off the definition tables at runtime, not
grepped. Kept anyway, because it is a plugin ABI surface — `isConstantEntry` is
re-exported through `@jbrowse/core/configuration`, an external plugin can
declare a constant with no in-tree trace, and removals on that surface fail
quietly (`PLUGIN_ABI_STABILITY.md`). Roughly 15 lines and one type-union member
is not worth that. The count is pinned by `ConfigSlotDefaults.test.ts`, so if
one is ever added it shows up as a snapshot line rather than being re-derived.
