# LinearReferenceSequenceDisplay — biology-surfacing feature ideas

Backlog of features that would help users read biology out of the reference
sequence display. Ordered roughly by value/effort. **Done:** hover introspection
(position + reference base + codon→amino-acid, see `sequenceHover.ts` +
`model.hoverAt`).

## Copy / "Get sequence" for a region

Let a rubberband selection (or the whole visible window) be extracted as:

- FASTA of the forward strand
- reverse complement
- protein translation (all 3 frames, or a chosen frame)

The building blocks already exist: `revcom`/`complement` from
`@jbrowse/core/util` and `getGeneticCode().codonTable`. The main work is a
selection affordance + a dialog/clipboard write. This is the single
most-requested bench task the display can't do today.

## ORF highlighting

The translation rows already classify every codon as start / stop / normal
(`codonKind`), but the biologically meaningful unit — a start→stop open reading
frame — is not drawn. Highlight ORFs above a configurable minimum length as
spans within each frame row (or as a hover/summary). This is exactly what users
scan a 6-frame translation to find, so surfacing it directly is high value.

Implementation sketch: a per-frame scan over the fetched region producing
`[start, stop)` intervals; paint a subtle underline/box in `drawTranslationRow`.
Config slot `minOrfLength`.

## Motif search wired into the track menu

`SequenceSearchAdapter` already does regex forward/reverse-strand matching, but
users must hand-author the adapter config. Add a "Search sequence motif…" menu
item that spins up a search track over this track's sequence adapter — mirror
the existing `addGCContentTrack` action pattern (`model.ts`). Makes an existing
capability discoverable.

## Restriction enzyme / PAM site overlay

Same mechanism as motif search but with a curated enzyme list (or CRISPR PAM via
the existing `CrisprGuideAdapter`). Common in cloning / editing workflows. Could
be a preset feeding the motif-search track, or a dedicated overlay.

## Inline GC-content strip

Today GC content requires adding a whole separate `GCContentTrack`
(`addGCContentTrack`). An optional thin GC row inside this display would surface
base composition without track-list clutter. Trade-off: adds a fetch/compute
path to a display that is currently pure per-base rendering.

## Peptide-track features

`trackMenuItems()` returns `[]` for non-DNA (`sequenceType: 'pep'`) tracks, so
protein reference tracks surface nothing. Candidates: residue property coloring
(hydrophobicity / charge), and a hover readout of residue properties. Would need
a peptide-specific palette + hover path parallel to the DNA one.
