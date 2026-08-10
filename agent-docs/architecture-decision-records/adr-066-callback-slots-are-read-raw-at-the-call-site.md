---
status: Accepted
summary: "A config slot holding a `jexl:` callback is forwarded by reading it raw (`self.conf.slot`) at the call site — the reader was NOT changed to skip evaluation on an arg-less read, because that changes plugin-ABI semantics for every caller to fix two"
---

# ADR-066: Callback config slots are read raw at the call site

## Status

Accepted (2026-08-10). Prompted by two shipped bugs with one cause and no
resemblance to each other, and by a repo-wide fix for them that was built,
measured, and backed out.

## Context

`readConfObject` / `getConf` / `resolveConf` take `args` as an **optional** third
parameter. So these are the same call:

```ts
readConfObject(conf, 'color')              // what is this setting
readConfObject(conf, 'color', { feature }) // what is this setting FOR this feature
```

Nothing at the call site, and nothing in the type, distinguishes them. On a slot
holding a `jexl:` expression the arg-less form evaluates anyway, against a
context where every name the expression mentions is `undefined`, and returns the
fallout as the setting.

Two displays shipped with that bug. Both curate their own `rpcProps()` slot by
slot, and both were forwarding a slot to a worker that would bind the feature
itself:

| slot | expression | arg-less read | symptom |
| --- | --- | --- | --- |
| `LinearManhattanDisplay.color` | `jexl:get(feature,…)` | throws `reading 'get'` | escapes the model getter, banners the display |
| `LinearMultiRowFeatureDisplay.partitionField` | `jexl:split(feature.name,…)` | `''`, because `split` is total | `''` ships as an attribute name; every feature lands in one unnamed row |

The wholesale snapshot path never had this bug: `fullConfSnapshot` reads raw MST
properties, so canvas and wiggle, which ship the whole snapshot, forward
expressions intact without anyone thinking about it. Only a curated `rpcProps()`
has to choose a reader, and the obvious choice is wrong.

`LinearBasicDisplay` had already worked around it locally four times
(`featureColor`, `utrColor`, `colorByMode`, and `renderConfig.ts` typing
`featureHeight` as `number | string` by hand). So six call sites had met this
before anyone looked at the reader.

## Decision

**A call site that forwards a callback slot reads it raw** — `self.conf.someSlot`,
the typed MST property, no reader involved. A call site that wants a value either
passes the feature in `args`, or guards with `isJexl` and falls back to a default
the way a color swatch does.

`CONFIG_PATTERN.md` §"Forwarding a callback slot" is the working reference; the
two fixed sites are pinned by canaries (`colorSlotTransport.test.ts`,
`partitionFieldTransport.test.ts`), and `pnpm check-deferred-slot-reads` ratchets
against new ones.

## The alternative that was built and backed out

**Make `readSlot` skip evaluation when `args` is empty**, returning the
expression instead. One change in `packages/core/src/configuration/readConfObject.ts`
fixes both bugs with no display touched at all; both canaries fail without it and
pass with it; `packages` + `plugins` were green (1112 suites, 11312 tests) and the
repo typechecked clean.

It was still the wrong trade:

- **It moves the type lie rather than removing it.** The read is still declared
  as the slot's resolved type and now hands back `"jexl:…"`. The old behaviour
  was type laundering — `jexl:1+1` on a `number` slot really did read as `2`,
  which `configTypeNarrowing.test.ts` asserted — and the new one is an honest
  value with a wrong type. Neither is a call site that can say what it wants.
- **It changes plugin-ABI semantics silently.** `@jbrowse/core/configuration` is
  in `ReExports/modules.ts`; `abiBaseline.json` guards names, not behaviour. So
  nothing failed and nothing would, while every third-party arg-less read of a
  callback slot changed meaning — including consumers that do arithmetic on the
  result and would propagate `NaN` somewhere quiet.
- **It trades an enumerable set of wrong values for an unenumerable one.** The
  bad arg-less reads inside this repo can be listed (they were: two, after the
  four pre-existing guards). The consumers outside it cannot be.

Making an arg-less callback read **throw** instead was considered and rejected
for the same ABI reason from the other direction: incidental arg-less reads in
third-party plugins go from working-by-accident to crashing, unannounced.

## Rejected: keying on `contextVariable`

More precise in principle — it would also catch a read that passes the *wrong*
context, which emptiness does not — and it was written, tested, and backed out
before the above.

`contextVariable` is config-editor metadata: it gates `SlotEditor`'s
value/callback toggle and names the variables in the callback editor's help.
Nothing in the read path consults it. Promoting it to a correctness invariant
means a slot that forgets to declare one silently reverts to the broken
behaviour — and `partitionField` had forgotten, which is exactly how it shipped
broken.

It is still the right marker for **tooling**, which is why the check script reads
it: a lint that misses a slot is a smaller failure than a reader that does.

## Consequences

- The trap is unchanged for anyone who doesn't know about it. A new curated
  `rpcProps()` can make the same mistake, and nothing in the type system stops
  it. That is the accepted cost, and it is what the check script and the doc
  section exist to reduce.
- **The check cannot be complete.** It matches reads by slot *name*, and a name
  is only a usable signal when every slot bearing it is callback-capable —
  `color`, `name`, `description`, `featureHeight`, `label`, `mouseover`, `size`
  and `thickness` all also exist as ordinary value slots on unrelated schemas.
  Those names are uncovered and the baseline says so. `color` being among them is
  the sharp edge: it is the most common callback slot. Tracing each read to its
  own schema would close it, and the checker will not do that through a widened
  config holder — the same wall `audit-config-read-types.ts` documents.
- **The typed repair is still open** and this ADR does not do it: forking the
  reader into a resolving read (accepts `args`, returns the resolved type) and a
  transport read (returns `T | string`), so a call site states which operation it
  wants. `self.conf.<slot>` is that transport read, informally — what is missing
  is anything that makes a call site use it or makes the resolved-typed read
  refuse. Doing it properly needs `ConfigurationSlotValue` to fork; note that
  `packages/core/src/configuration/CLAUDE.md` §"Read type narrowing" records that
  threading generics through these readers has been tried and failed, for a
  different reason but on the same machinery.
- `LinearManhattanDisplay` gained a typed `conf` getter (the `ConfigurationReference`-
  erases-to-`any` idiom every other display already had) so its raw read is
  checked rather than `any`. Its `color` slot and `LinearMultiRowFeatureDisplay`'s
  `partitionField` both gained `contextVariable: ['feature']`, which they had been
  missing — an editor affordance only, and deliberately not a correctness signal.
