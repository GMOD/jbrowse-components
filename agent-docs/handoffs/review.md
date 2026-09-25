---
name: review
description: Brief for reviewing the link-mark round: the size channel, the x2 mate form, the mate transform step and render-core linkMark.
---

Please review previous agents work:
  Landed on main and cleaned up. Four commits, de0a383e01 through c860b6e68f, and the primary checkout is clean.

  What landed

  - Encoder and transform. size is a per-instance channel with linear and log scales into a px range, x2 takes GenomeSpy's { chrom, pos } form so a mate on another sequence names which, and a mate transform step pairs BEDPE, STAR-Fusion and VCF breakend records in the worker. The SV ALT parsing moved into core, which took @gmod/vcf.
  - The link shape. render-core's linkMark is the alignments band's half-ellipse with an exact fragment distance, its far-circle legs, and one new mechanism: a uniform table of the view's displayed regions that both feet place through. A curve between two regions draws on the GPU from every block holding a foot, a pan writes one uniform and no buffer, and a mate with no region draws a stem. The band's curve distances moved into render-core, and the sweep gate now flattens stroked curves.
  - The mark display. mark: 'link', linkShape of dome or arc, an optional y for the apex, mate regions resolved once per fetch through the assembly's aliases, and size domains unioned over regions like a ramp's.
  - The deletion. plugins/arc is gone with its two display types, RPC, jexl functions and pages. Volvox, the demo config, the Hi-C guide, the RNA-seq tutorial, the cancer figure spec, the developer guides' worked examples, the browser and web tests, and the agent docs are rewritten. ADR-163 records the decision and what it drops.

  Gates. Typecheck, verify, autogen, the docs regenerators, and 926 tests across the marks, shape, encoder, transform and validator suites are green on the final tree. The related-suite run passed on the pre-rebase tree.

  Not done, because you asked to wrap up. No Fable review ran on this diff, and it is large enough to deserve one first thing. CI will show fix-forwards I could not run here: the jbrowse-web config-slot and model snapshots still list the arc displays, two browser goldens change picture, and the alphagenome figure spec waits on a test id only the external plugin's old display carried. The docs check is red on main for a stale v5.0.0 release draft unrelated to this. One dependency-set pin in the linear genome view's fetch tests fails on main's own probes, not this branch. I wrote all of this to memory under link-mark-thread, with the alignments band and the circular chords named as the next consumers.
