### Alignments

**Samplot mode follow-ups.** Landed: flat lines + Y=|tlen| + SV-type palette,
shared Canvas2D ⇄ SVG rasterizer, samplot as a `pairedArcs` mode (not a hidden
color scheme), discordant-only filter (FR pairs inside the insert-size stats
band are dropped, mirroring samplot.py's `--max_depth 1`), rotated TLEN
scalebar label, deterministic per-pair jitter (stable snapshots). Remaining:


- *Discardable samplot strand fallback.* `getSamplotColorIndex`'s
  strand-only branch (split reads with no `pairOrientationNum`) collapses
  to same-strand→INV, else→DEL. Proper DUP classification for split reads
  requires reading query order + genomic order together; left un-wired
  because the rare case has limited signal-to-noise.
- *Endpoint markers.* samplot.py draws square markers (`marker="s"`) at both
  ends of paired-read lines and circle markers (`marker="o"`) at split-read
  line ends. Would require generating extra geometry per arc instance in the
  shader (a small square/circle quad at each x1/x2). Canvas2D path would use
  `ctx.fillRect` / `ctx.arc`. Medium scope; skip until visual need is confirmed.
- *Line width: split vs paired.* samplot.py uses `lw=1` for split reads and
  `lw=0.5` for paired reads. Currently both use the same `arcLineWidth`
  uniform. Could pass per-instance width or use two separate draw calls.
  Low visual impact; defer.
- *Y-axis domain margin.* samplot.py uses `ylim_margin = max(1.02 + jitter_bounds, 1.10)`
  (percentage-based, adjusts for jitter). JBrowse uses a fixed 8 px pixel margin
  (`ARC_HEIGHT_MARGIN`). Minor visual difference; defer.



