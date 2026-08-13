---
name: config-cleanups-declined
description: Declined in the 2026-08 audit: the `fullConfSnapshot` throw and the config editor's slot enumeration. Read before re-proposing either.
---

# Config package cleanups declined (2026-08 audit)

Two changes the 2026-08-09 audit of `packages/core/src/configuration` considered
and did not make. Both are defensible. Neither earns its regression surface
until something forces the question, and each already carries the check that
would have to come first.

**A throw in `fullConfSnapshot` for arrays/maps of sub-schemas**, matching the
`assertNoPromotableSlots` treatment three lines below it. The current comment
says those are dropped because "nothing has needed them". A config that does
carry one is silently fine today, and a throw would break it at the first worker
payload. Establish that no display config carries such a slot before converting
silence into a throw. Related negative result, already paid for: dropping `type`
and the identifier from a display snapshot breaks no consumer. Grepped
`displayConfig.type` / `displayConfig[` across `packages`, `plugins`,
`products`; the one production call of `getConfigSnapshotWithPromotables` is
`plugins/canvas/src/LinearBasicDisplay/baseModel.ts`, which reads neither.

**The config editor enumerating slots off the registry** instead of
`getMembers(schema).properties` (`ConfigurationEditor.tsx`). It is the last
reader of slot structure going through MST reflection rather than
`getConfigurationSchemaDefinition`, which `schemaRegistry.ts` calls "the single
accessor". Row order *should* survive the swap, since `modelDefinition` is built
by iterating the definition and just prepends `type` and the identifier, both of
which render as null. That is reasoned, not run, and the panel has snapshot
tests. The payoff is tidiness, so the check has to be worth it.
