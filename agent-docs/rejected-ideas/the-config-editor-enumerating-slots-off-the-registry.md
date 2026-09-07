---
name: the-config-editor-enumerating-slots-off-the-registry
description: The config editor enumerating slots off the registry
area: config-and-mst
---

# The config editor enumerating slots off the registry

instead of
`getMembers(schema).properties` (`ConfigurationEditor.tsx`) — declined in the
same audit. It is the last reader of slot structure going through MST
reflection rather than `getConfigurationSchemaDefinition`, which
`schemaRegistry.ts` calls "the single accessor". Row order *should* survive
the swap, since `modelDefinition` is built by iterating the definition and
just prepends `type` and the identifier, both of which render as null — but
that is reasoned, not run, and the panel has snapshot tests. The payoff is
tidiness, so the check has to be worth it.
