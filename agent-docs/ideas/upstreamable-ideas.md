---
name: upstreamable-ideas
description: The extraction work is aimed at other libraries copying the patterns, not at more people installing JBrowse — so an extraction is only finished when the idea has a name outside its JBrowse spelling. The inventory of what travels, split by whether it needs genomics, and why 45,264 lines of design writing currently reach nobody.
---

# Ideas worth upstreaming

The goal this doc is written against, in Colin's words (2026-08-19): *your goal
isn't to make every app use your library, it's to make other libraries copy the
ideas you value the most. The failure case is good ideas dying with your code.*

JBrowse is a standard in genomics and a rounding error on npm. That combination
makes adoption the wrong success metric for the packaging work in
[lightweight-toolkit.md](lightweight-toolkit.md), and it makes propagation the
right one.

## The failure case here is narrower than "dying with the code"

The ideas are written down. `agent-docs/` is 203 files and 45,264 lines,
including 73 ADRs, and the reasoning behind most non-obvious decisions in this
repo is somewhere in it.

All of it is addressed to agents working in this repository, in this
repository's dialect, in a directory `.prettierignore` skips and no build
publishes. The only outward-facing narrative channel is `website/blog/`, and
115 of its 122 entries are release announcements — the most recent of the other
seven is a year-in-review from 2025-02-13. `planRegionFetch` appears zero times
anywhere under `website/`.

So the ideas will not die with the code. They will die *in the repo*, which is
a different problem and a much cheaper one to fix.

## Two audiences, and they do not behave alike

**Genomics visualization.** JBrowse's name carries weight, the blog reaches the
people who care, and the genome-specific work is the differentiator rather than
a limitation — `hpmath`'s float32 bp precision, `regionRegistry`, absolute-uint32
worker output, and the Canvas2D → WebGL2 → WebGPU ladder with a
backend-agnostic lifecycle. Publish these under JBrowse's own name.

**General programming.** The JBrowse name is close to invisible and the idea has
to travel on its own, to wherever that audience already is — a React Compiler
issue, a MobX discussion, a post that never needs the word "genome." Three
groups of these are worth writing:

- [mobx-state-patterns-to-publish](mobx-state-patterns-to-publish.md) — the
  autorun plan/installer split and the discriminated lifecycle getter.
- [barrels-block-extraction](barrels-block-extraction.md) — a controlled
  comparison inside one repo between a package with a barrel and one without.
- [green-checks-that-cannot-fail](green-checks-that-cannot-fail.md) — four
  checks here that passed for structural reasons, and how each was caught.

## What makes an extraction finished

A published package nobody installs propagates nothing on its own, and a post
with no runnable artifact behind it propagates less than it should. The package
is what makes an idea citable and runnable; the writeup is what makes it
findable. Neither half works alone, which is the ordering trap in
[lightweight-toolkit.md](lightweight-toolkit.md)'s work list — every item there
is internal refactoring that *enables* propagation without being it.

So the test for an extraction proposal is: **name the transferable idea it
carries and the audience it reaches.** An extraction that cannot answer that is
tidying, which is fine, but it should not be counted against this goal.
