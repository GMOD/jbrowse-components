---
name: brand-the-out-of-request-refnames
description: branding the out-of-request refNames — mate, partner, target — is a compile-time-only narrowing, and it is cheap exactly while the tree's comparisons still agree, which is a window that closes as the tree grows
---

# Brand the out-of-request refNames

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The window it wants to be taken in is the tree's, not the
release's, and nothing ships differently either way.

Read [reference/REFNAME_NAMESPACES.md](../reference/REFNAME_NAMESPACES.md) first —
it holds the rule, the six plugins that hit it, and the six different answers
they each invented. This entry is what is left after synteny's.

`type AdapterRefName = string & { readonly __ns: 'adapter' }`, on the
**out-of-request** names only — mate, partner, target — not on refName
generally. Compile-time only: the property never exists, values stay plain
strings, nothing changes over the wire. The reference doc has the error codes,
verified against TS7 `--strict` rather than derived: TS2367 comparing two
brands, TS2345 into a `Map<Canonical,_>.get`, TS7053 into a
`Record<Canonical,_>[…]` — which are the three shapes the broken sites took.

**The trap, and it is the whole difficulty:** `plain === branded` does **not**
error, because `string` and `string & {…}` overlap. Branding one end buys
nothing. It also cannot catch a site that hands the name to a core function
taking a plain `string` — `positionViewOnSpan` → `bpToOffset` is the known one,
so this is a narrowing rather than a proof.

Now is the cheap moment, and that ordering is the point: branding a tree whose
comparisons already agree is a type-only change, where branding a broken one
buys an error list to wade through.
