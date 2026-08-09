---
name: config-package-cleanup
description: An audit of packages/core/src/configuration on 2026-08-09 that landed four fixes (d8d18b9428) and left three threads open — a reader consolidation blocked on a peer's barrel refactor, base-hook composition blocked on an MST-fork question, and two items considered and declined. Carries the negative results the audit produced (the combinations that do not occur in the repo, the call shapes that made a signature change safe, the hot-path trap in the obvious consolidation) so the next pass does not re-derive them. Read before touching the readers, the schema-construction hooks, or fullConfSnapshot.
---

# Config package: what the audit landed, and what it left

Audit of `packages/core/src/configuration` plus its consumers (`JBrowseConfig` /
`RootConfiguration`, `baseTrackConfig`, the hierarchical track selector, the
config editor, `product-core`'s About-dialog readers) on 2026-08-09. Four fixes
landed in `d8d18b9428`. This file is about the rest.

The package came out of it in good shape. The registry, the promotable cascade,
and the construction-time guards are coherent and heavily commented, and most of
what looks odd on a first read is a decision with a reason attached. Everything
below is a small delta on a healthy subsystem, not a rescue.

## Do not re-derive these

Negative results and measurements the audit produced. Each of them cost a scan
or a whole-repo typecheck.

| Question | Answer, as of 2026-08-09 |
| --- | --- |
| Does any schema declare `promotedBase` **and** `contextVariable`? | No. Scanned all 22 files mentioning `promotedBase`; the only hits were the type declarations themselves. The new guard is preventive. |
| Do `slotTypes` and `SlotValueByType` currently agree? | Yes, 15 keys each, identical. Now asserted rather than checked by hand. |
| Is `toFixedValue`'s "no fallbackDefault for type X" throw reachable from the config editor? | Not today. It needs a slot whose `type` is outside the builtin table (only `stringEnum`/`maybeStringEnum`) **and** a `jexl:` `defaultValue` **and** a `contextVariable` to raise the toggle. Every slot in the repo with a jexl default is `number`/`string`/`color`, all of which have a `fallbackDefault`. |
| Does anything call `getConf(x, undefined, args)`? | No. That is what made `slotPath` required on the typed overload safe. |
| Does `fullConfSnapshot` omitting `type` and the identifier from a display snapshot break a worker? | No consumer found. Grepped for `displayConfig.type` / `displayConfig[` across `packages`, `plugins`, `products`. The one production call of `getConfigSnapshotWithPromotables` is `plugins/canvas/src/LinearBasicDisplay/baseModel.ts`, which does not read either. |
| Is `readConfSlot` on a public surface? | No. It lives in `packages/product-core/src/ui/util.ts` with four relative importers inside that same `ui/` directory and no re-export. Moving it costs nothing downstream. |
| Does removing `as IAnyModelType` from `pluggableConfigSchemaType` break anything? | No. Whole-repo `tsc --noEmit` was clean. Landed. |

## Thread 1: one reader instead of three (blocked, then straightforward)

There are three readers that walk a slot path and evaluate a `jexl:` value:

| reader | where | accepts | jexl args |
| --- | --- | --- | --- |
| `readConfObject` | `readConfObject.ts` | live MST node | any record, env-resolved jexl |
| `readConfigValue` | `readConfObject.ts` | plain object | hardcoded `{feature}`, explicit jexl |
| `readConfSlot` | `product-core/src/ui/util.ts` | **either** | any record, optional jexl |

`readConfSlot` is a strict superset of `readConfigValue`, and `resolveConfigValue`
(`readConfObject.ts`) re-implements the same plain-object path reduce that
`readConfSlot` does, ten lines below the MST walk that is the third copy.

The move is: `readConfSlot` into `readConfObject.ts` beside `readConfigValue`,
its plain branch implemented on the existing `resolveConfigValue`, exported from
the barrel, and the four `product-core/src/ui` importers repointed. That deletes
one duplicated walk and puts the "config that might be a snapshot" reader where
plugins can reach it.

**The trap, which is why the obvious version is wrong.** Do **not** make
`readConfigValue` delegate to `readConfSlot`. `readConfSlot` normalizes a string
path into a one-element array on entry, and `readConfigValue` is called
per-feature inside render loops — `readConfObject` goes out of its way to keep
the single-slot read allocation-free for exactly this reason (see its "first and
allocation-free" comment). Leave `readConfigValue` alone; the sharing goes
through `resolveConfigValue`, not through the general reader.

**Why it did not land.** It needs `configuration/index.ts`, and another agent was
mid-refactor in that exact file, pulling the `FormatAbout` / `FormatDetails`
schema factories and a shared `mergeFormatCallbacks` out of `product-core` into
their own modules under `configuration/`. Editing the barrel underneath that
would have collided. Once their work is committed this is a contained change
with no open questions.

## Thread 2: compose base hooks instead of throwing (one question first)

`configurationSchema.ts` throws when a schema and its `baseConfiguration` both
declare any of `actions` / `views` / `extend` / `preProcessSnapshot`, because the
options merge is a shallow spread and the child's would silently replace the
base's.

The consequence is sharper than the comment suggests: `createBaseTrackConfig`
declares **two** of them (`preProcessSnapshot` and `actions`), so **no track
config schema can ever declare its own**. Verified — all six that extend it
(`GWASTrack`, `MafTrack`, `GCContentTrack`, `AlignmentsTrack`, `HicTrack`,
`SyntenyTrack`) declare neither, and the escape hatch is the global
`Core-preProcessTrackConfig` extension point (`migrateTrackConfig.ts`).

Composition is the natural fix and would keep the property the throw exists to
protect: `.actions()` / `.views()` already chain in MST, and `preProcessSnapshot`
composes as `child(base(snap))`.

**Open question, settle it before writing code:** what the fork's
`.preProcessSnapshot()` does when called twice on one model — whether the second
wraps the first and in which order. The whole design rests on that.

**What composition would *not* fix, so do not sell it on this.**
`ReferenceSequenceTrack/configSchema.ts` hand-rolls a copy of the base's slots
and re-imports `preprocessTrackConfigSnapshot` / `trackConfigActions`. That is
because it wants a **subset** of the base's slots (its own header comment says
so), and `baseConfiguration` only ever adds. Composition leaves it exactly where
it is.

## Considered and declined

Both are defensible; neither earns its regression surface right now.

- **A throw in `fullConfSnapshot` for arrays/maps of sub-schemas**, matching the
  `assertNoPromotableSlots` treatment three lines below it. The current comment
  says they are dropped because "nothing has needed them" — but a config that
  *does* have one is today silently fine, and a throw would break it at the first
  worker payload. Establish that no display config carries such a slot before
  converting silence into a throw.
- **The config editor enumerating slots off the registry instead of
  `getMembers(schema).properties`** (`ConfigurationEditor.tsx`). It is the last
  reader of slot structure that goes through MST reflection rather than
  `getConfigurationSchemaDefinition`, which `schemaRegistry.ts` calls "the single
  accessor". Row order *should* survive the swap — `modelDefinition` is built by
  iterating the definition, just with `type` and the identifier prepended, and
  both of those render as null — but that is reasoned, not run, and the panel
  has snapshot tests. The payoff is tidiness, so it needs to be worth the check.

## Not this file's business

The parked promotable-slot UI work and the admin tier for display-type defaults
are in `OTHER_IDEAS.md` (§"Promotable-slot UI", §"Admin tier for promotable
display-type defaults"), each with a design that already survived a rejected
alternative. The audit did not touch them and they are unaffected by anything
here.
