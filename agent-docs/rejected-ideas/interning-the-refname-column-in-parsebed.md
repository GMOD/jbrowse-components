---
name: interning-the-refname-column-in-parsebed
description: Interning the refName column in `parseBed`
area: performance-and-measurement
---

# Interning the refName column in `parseBed`

measured 2026-08-20 and
declined. jcvi's grape BED holds 33 distinct scaffold names over 55,564 rows,
which is the shape interning is supposed to be for, and it lost on both
counts: a `Map<string, string>` lookup per row cost 28% (35.6ms -> 46.0ms),
and the heap delta across four alternating measurements was noise in both
directions. The strings it deduplicates are short enough that V8 allocates
them flat, so a second reference to one saves nothing, and JS string equality
is by value — meaning the win it was supposed to hand downstream (a pointer
compare in the synteny worker's string dictionaries) is not observable from JS
at all. The reasoning is kept at the arm it is not, in
`plugins/comparative-adapters/benches/mcscanParseBed.bench.ts`.
