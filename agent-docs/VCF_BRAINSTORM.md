 what is your opinion on removing the vcf concept. was the vcf a good idea? will we be better off
  with our own approach?

● Update(agent-docs/GRAPH_PLAN.md)
  ⎿  Added 1 line, removed 1 line
      301  `#` lines are skipped by tabix and returned by `getHeader()`. A file with no
      302  header still works if the track config sets `assemblyNames` explicitly.
      303
      304 -### chr20 proof-of-concept (verified 2026-05-14)
      304 +## chr20 proof-of-concept (verified 2026-05-14)
      305
      306  The full pipeline runs end-to-end on the HPRC chr20 graph:
      307

  Searched for 2 patterns (ctrl+o to expand)

● Doc work is done — GRAPH_PLAN.md no longer contains the variantsAdapter/VCF design, and ADR-030
  records the decision. Now, your question — my honest take:

  Removing it is right, and we'll be better off — but the usual framing ("standard format vs. our own
  approach") gets why backwards.

  Was the VCF a good idea? It was a reasonable idea that doesn't survive the data model. adr-025's
  principle was sound — "use the standard maintained primitive (vg deconstruct), not a bespoke
  unaudited re-derivation." It was just applied at the wrong layer. The synteny display's natural unit
   is an alignment block between two haplotypes, and the detail you want is "what are the edits within
   this block" — that's intrinsically alignment data. VCF is position-based variant calls relative to
  a reference, a different shape. Forcing block-local edits through VCF means re-joining
  genome-position records back to blocks, and that join (PanSN names ↔ VCF GT-header names) is the
  fragile part. The tell: adr-025 escaped one implicit producer contract (X-CIGAR) and the
  variantsAdapter design promptly introduced another (the sampleNameMap join). The standard format
  didn't remove the fragility — it relocated it.

  Is the cs:-PAF "our own approach"? Not really, and that's the crux. cs: is minimap2's standard tag,
  PAF is a standard format, minimap2 --cs emits exactly this. We're trading one standard (VCF) for a
  more appropriate one, at the layer where the data lives. adr-025's real win was killing the bespoke
  binary CS format (bubbles.bed.gz, BCS opcodes) — the cs:-PAF keeps that win. What's "ours" is only
  the pipeline recipe, not a format.

  So yes, better off — one track, one file, one display, no join, no second source, no new runtime
  config. But the honest costs:

  - We lose the free standard-VCF UX — variant feature widget, genotype matrix, VCF filtering. If that
   matters, VCF export becomes a separate optional thing.
  - The hard part moves to data prep, and it's genuinely hard. Beyond chr20-scale batching: the
  enrich-vs-replace open question must land on "enrich" — if "replace with a per-haplotype minimap2
  PAF" wins, we've quietly undone adr-024's graph-awareness. That's the thing I'd watch.
  - minimap2-derived cs: is a re-derivation. The graph already knows the exact per-base differences —
  they're the node structure. Re-aligning extracted subsequences is pragmatic but can diverge from the
   graph's own decomposition. The other agent's "graph-walk fallback" is the theoretically-correct
  route. Pragmatism is fine — but keep vg deconstruct as the validation oracle (workstream C does) and
   watch for divergence.

  Bottom line: the VCF was the right instinct (use standards) at the wrong layer. The cs:-PAF applies
  the same instinct at the right layer. Net positive — provided "enrich" beats "replace" and we
  validate against an oracle rather than trusting the re-derivation.

✻ Churned for 7m 47s

❯ i believe the vcf ostensibly would store true node labels in though in the file which is valuable

● You're right, and I under-weighted it. Let me be specific about what you're pointing at and what it
  actually implies.

  What the VCF retains: vg deconstruct writes an AT (allele-traversal) INFO field — each allele
  encoded as its oriented node-ID path, e.g. AT=>1>2>4,>1>3>4. That ties every variant back to the
  graph topology. It also carries LV/PS (snarl nesting) — which is, notably, a chunk of the very
  bubble hierarchy adr-029 phase 2 plans to recompute. So the VCF isn't just "variants" — it's
  graph-linked variants.

  Why that's valuable: node IDs are the join key to everything else graph-derived — the layout
  (adr-028), the bubble hierarchy (adr-029), the GetSubgraph path. A variant carrying node IDs lets
  you click a SNP on the synteny display and jump to that exact node in the graph view. Node-ID
  equality is also the exact test for "same allele" across haplotypes — sequence comparison can't
  match it (homoplasy: same sequence, different path). And node IDs are the graph's own answer, not a
  re-derivation.

  But here's the sharpening — and it's important: this is an argument for the per-base data being
  graph-derived, not an argument for VCF-the-container. minimap2 --cs also discards node labels — it
  never sees the graph; it re-aligns extracted sequences. So the cs:-PAF-via-minimap2 path loses
  exactly the thing you're describing, but not because it's a PAF — a PAF record can carry a
  node-traversal tag alongside cs: just fine. It loses it because minimap2 can't produce one. The
  format isn't the constraint; the derivation method is.

  That reframes two things:

  - The other agent's "graph-walk fallback" shouldn't be a fallback. Deriving per-base edits by
  walking the graph's node structure is the one approach that's both exact and node-label-preserving.
  minimap2 --cs is the pragmatic shortcut that happens to throw away the most graph-valuable piece.
  Your point is the strongest argument yet that graph-walk derivation is the real target, not the
  fallback.
  - adr-030's actual win is narrower than "remove the VCF." What was genuinely wrong was the runtime
  join — variantsAdapter + sampleNameMap wiring the VCF into the display through a fragile sample-name
   match. Killing that is right. But that's not the same as killing the VCF artifact. A vg deconstruct
   VCF with AT is a perfectly good standalone graph-linked variant file — it just shouldn't be the
  synteny display's data source. It's already kept as the validation oracle in workstream C; keeping
  it as a shipped artifact for the graph-linkage use case costs nothing and preserves what you're
  describing.

  So my revised opinion: removing the runtime VCF join — still right. Removing the VCF concept
  entirely — that goes too far, and you've put your finger on why. The fix isn't "put the
  variantsAdapter back," it's: (a) keep the vg deconstruct VCF as a standalone graph-linked artifact,
  and (b) make the synteny display's per-base data graph-derived so it carries node IDs too, instead
  of accepting minimap2's node-blind cs:.

  Want me to fold this into ADR-030 — narrow its scope to "removes the runtime join, not the VCF
  artifact," and promote graph-walk derivation from fallback to the primary candidate?

✻ Worked for 1m 30s

❯ by using minimap we are re-deriving

❯ we could try to use or recode our own approach vg deconstruct that preserves this concept

● Exactly — and let me pull on that, because I think it lands somewhere clean.

  The de-risking point first: changing the derivation doesn't touch the proven runtime. cs: is a
  defined format; the renderer doesn't care whether the string came from minimap2, from vg
  deconstruct, or from a graph walk. So this isn't reopening the other agent's runtime work — it only
  changes workstream-A's data-prep steps. That makes it a much cheaper change than it sounds.

  On "no join": the other agent's framing was "cs: is intrinsic to the block, so no join." The truer
  statement is: the join moves to preprocessing, done once and verifiably, and the output artifact has
   no join. minimap2 gets there by re-aligning the block's own two sequences (no graph, no join — but
  also no node IDs). A graph-aware derivation gets there too, and keeps the node IDs.

  Use vs. recode — it's a real tradeoff, not a slam dunk:

  - Use vg deconstruct: standard, correct, maintained, snarl-aware, gives you AT node traversals for
  free. The catch: its snarl decomposition is a different cut of the graph than untangle's blocks.
  You'd map deconstruct's ref-positioned per-sample variants onto untangle blocks by coordinate +
  sample in preprocessing. Risk: two decompositions that may not align cleanly.
  - Recode our own (graph-walk within blocks): for each untangle block you already know haplotype H
  and the ref. Walk H's path and the ref's path through the graph over that block's range, diff them —
   divergences are variants, and you have the node IDs because you walked them. No join at all (you
  walk H's path directly), and a single decomposition (untangle's blocks). The catch: "diff two paths
  through a graph correctly" with nested variation is snarl-aware path comparison — a real algorithm.
  But scoped within a block it's far smaller than whole-graph snarl decomposition, and
  @jbrowse/graph-core already parses the paths.

  My lean: don't reinvent whole-graph variant calling — but the graph-walk-within-blocks is the more
  architecturally consistent option (one decomposition, zero join, node IDs intrinsic), and it's
  bounded enough to be tractable. I'd prototype both on volvox and let that settle it — which folds
  straight into workstream A's step 1, just promoting "graph-derived vs. minimap2-derived" to the
  primary axis the prototype decides, above "enrich vs. replace."

  What I'd change in the docs: ADR-030's decision is currently "cs:-PAF, derived via minimap2 --cs."
  That should become "cs:-PAF transport, graph-derived (vg deconstruct mapped in prep, or graph-walk
  within blocks), join moved offline, node-traversal tags carried for graph-view linkage" — minimap2
  demoted to a pragmatic fallback, not the primary. And workstream A's derivation method changes
  accordingly.

  One coordination flag: workstream A is the other agent's plan and they have a minimap2-based runtime
   proof. The runtime proof still stands (cs: is cs:), but their step 1–3 approach changes. Want me to
   update ADR-030 + GRAPH_PLAN workstream A to this graph-derived framing now, and leave a note for
  the other agent that the derivation method shifted (runtime unaffected)?

