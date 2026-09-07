---
name: a-throw-in-fullconfsnapshot-for-arrays-maps-of-sub-schemas
description: A throw in `fullConfSnapshot` for arrays/maps of sub-schemas
area: config-and-mst
---

# A throw in `fullConfSnapshot` for arrays/maps of sub-schemas

declined in
the 2026-08-09 audit of `packages/core/src/configuration`, matching the
`assertNoPromotableSlots` treatment three lines below it. Those are dropped
because "nothing has needed them"; a config that does carry one is silently
fine today and a throw would break it at the first worker payload. Establish
that no display config carries such a slot before converting silence into a
throw. Related negative result, already paid for: dropping `type` and the
identifier from a display snapshot breaks no consumer — grepped
`displayConfig.type` / `displayConfig[` across `packages`, `plugins`,
`products`, and the one production call of `getConfigSnapshotWithPromotables`
is `plugins/canvas/src/LinearBasicDisplay/baseModel.ts`, which reads neither.
