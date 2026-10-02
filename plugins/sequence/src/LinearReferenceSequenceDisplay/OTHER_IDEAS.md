# LinearReferenceSequenceDisplay — biology-surfacing feature ideas

Backlog of features that would help users read biology out of the reference
sequence display. Ordered roughly by value/effort. **Done:** hover introspection
(position + reference base + codon→amino-acid, see `sequenceHover.ts` +
`model.hoverAt`).

## Copy / "Get sequence" for a region

The track menu's "Get sequence (visible region)" and the rubberband menu open
`GetSequenceDialog`. Still missing from there:

- FASTA of the forward strand
- reverse complement
- protein translation (all 3 frames, or a chosen frame)

`revcom`/`complement` from `@jbrowse/core/util` and
`getGeneticCode().codonTable` already exist.

## ORF highlighting

The translation rows already classify every codon as start / stop / normal
(`codonKind`), but the biologically meaningful unit — a start→stop open reading
frame — is not drawn. Highlight ORFs above a configurable minimum length as
spans within each frame row (or as a hover/summary). This is exactly what users
scan a 6-frame translation to find, so surfacing it directly is high value.

Implementation sketch: a per-frame scan over the fetched region producing
`[start, stop)` intervals; draw them as a further mark over the translation
rows. Config slot `minOrfLength`.

## Motif search wired into the track menu

`SequenceSearchAdapter` already does regex forward/reverse-strand matching, but
users must hand-author the adapter config. Add a "Search sequence motif…" menu
item that spins up a search track over this track's sequence adapter — mirror
the gccontent plugin's `Core-extraTrackMenuItems` row
(`plugins/gccontent/src/extraTrackMenuItems.ts`), which reaches the hierarchical
selector's menu as well as this one. Makes an existing capability discoverable.

## Inline GC-content strip

Today GC content requires adding a whole separate `GCContentTrack` from the
track menu. An optional thin GC row inside this display would surface base
composition without track-list clutter. Trade-off: adds a fetch/compute path to
a display that is currently pure per-base rendering.

## Peptide-track features

A protein reference track (`sequenceType: 'pep'`) shows one row of residues in
the fallback grey. Candidates: residue property coloring (hydrophobicity /
charge), and a hover readout of residue properties. Would need a
peptide-specific palette + hover path parallel to the DNA one.
