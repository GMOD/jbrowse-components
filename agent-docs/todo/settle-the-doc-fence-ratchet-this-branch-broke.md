---
name: settle-the-doc-fence-ratchet-this-branch-broke
description: the agent doc pages put un-included TS/JS fences at 26 against a baseline of 21, so autogen --check fails at merge
metadata:
  area: website, CI
  category: ready
  order: 8
  first_move: "decide whether these fences can point at real source; if they cannot, raise DOC_FENCE_BASELINE to 26 in one commit that says why"
---

# Settle the doc-fence ratchet this branch broke

`pnpm autogen --check` fails on `worktree-mcp-demo`, and CI runs it. The
generated model and config pages were fixed by regeneration (`53b7204761`), but
the other half cannot be:

```
26 hand-written TS/JS fences in the docs exceeds the baseline of 21
```

`sync-doc-snippets.ts` ratchets un-included fences so the debt can only shrink.
The agent pages this branch added — `agents_mcp.md` chief among them — carry
illustrative `jb` calls, and the count went from 21 to 26.

## The decision

The ratchet's own message names both moves: point a fence at real source with an
`<!-- include: -->` marker, or raise `DOC_FENCE_BASELINE` "if it genuinely can't
be".

**Most of these genuinely can't be.** An `include:` marker points at compiled,
tested source and fills the fence from it; the `jb` examples are illustrative
API usage assembled for a reader, not a region of any file that exists. The
honest options are to raise the baseline to 26 with a comment saying which page
spent it, or to convert the examples into a real tested fixture that the marker
can point at — which is the better answer if anyone wants to write one, since it
also gives `jb` an executable example.

Raising a debt ceiling is deliberately not something to do inside an unrelated
commit, which is why this is a row rather than already done.

## Do not

Add more hand-written fences meanwhile. `agents_web.md` was written to add
**zero** — its examples are prose and inline code for exactly this reason, and a
plain untagged fence (the region-too-large error text) is not counted.
