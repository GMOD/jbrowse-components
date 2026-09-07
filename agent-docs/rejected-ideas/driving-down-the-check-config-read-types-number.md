---
name: driving-down-the-check-config-read-types-number
description: Driving down the `check-config-read-types` number
area: config-and-mst
---

# Driving down the `check-config-read-types` number

—
[ADR-052](../architecture-decision-records/adr-052-slot-name-safety-is-a-write-guard.md),
which also declined the accessor codegen. Worth restating because the number
reads as a backlog and mostly isn't: narrowing all nine widened display
factories moved it by **6 reads**, 61% to 62% of the surface — both readings
taken 2026-08-04, and the ADR carries the live table. Most of the residue is a
handful of slot names, 79<!--m:config-read-gap-populations.track-or-assembly-schema.reads-->
of the 133<!--m:config-read-type-gaps.source.unchecked--> unchecked source
reads, and they are against the *track* or *assembly* schema, which the
baseline groups under whichever display file contains them — so they look like
display debt and no display narrowing can reach them. The split is in
[TODO.md](../TODO.md)'s entry for the baseline; the baseline's own value is
diagnostic (does narrowing *this* factory buy anything), not a target.
