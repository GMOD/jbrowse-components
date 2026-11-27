---
name: open-genome-makes-a-feature-track-from-a-genbank
description: "The open-genome form reads a GenBank as a genome or as annotation but opens no feature track from it, so a bacterial or viral genome arrives with no genes; the desktop start screen can add the track cheaply, the in-session form needs a companion-track contract."
---

# Open genome makes a feature track from a GenBank

The form opens no feature track from a GenBank, whether it is the genome or its
annotation.

- A lone GenBank becomes the `GenbankSequenceAdapter` assembly alone.
- A GenBank beside a FASTA, .fa.gz or 2bit that can open as dropped (Prokka's
  .fna + .gbk) is read as that genome's annotation (`partitionSequences` in
  [`assemblyConfigUtils.ts`](../../../packages/core/src/util/assemblyConfigUtils.ts)):
  the other file is the genome, and `FileNotices` in
  [`AddGenomePane.tsx`](../../../packages/core/src/ui/AddGenomePane.tsx) says
  to drop the GenBank on a view of it, or use Open track, once one is open.
- Beside an unindexed .fna.gz (NCBI's FTP pair) the GenBank stays the genome.

Dropping the file on an open view already stages it as a `GenbankAdapter`
track. The form has no way to return a track with an assembly.

## The build

- Desktop start screen first: it builds the new session's config with an
  empty `tracks` list
  ([`StartScreenDialogs.tsx`](../../../products/jbrowse-desktop/src/components/StartScreen/StartScreenDialogs.tsx)),
  so a `GenbankAdapter` track on the new assembly can go there.
- In-session Open genome and the web assembly manager form need the form to
  return a companion track, a new contract across both callers: `FormState`
  carries the annotation locations, `buildAssemblyConf` or its callers turn
  them into track confs on the new assembly name, and the notice becomes a
  line on the recognition card.
