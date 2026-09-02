---
title: Troubleshooting
description:
  Diagnosing a track that is empty, blank, slow, or a session that will not
  restore
---

## My track loads but shows no features

The usual cause is a reference name mismatch: the file names its chromosomes
differently than the assembly (`chr1` vs `1`, or `NC_000001.11` vs `chr1`).
[Reference name aliasing](/docs/config_guides/assemblies#configuring-reference-name-aliasing)
covers confirming that from the "About track" dialogs and mapping the two
schemes together.

Also check:

- the region in view has data at all
- no "Zoom in to see features" message is showing (see
  [the region limits](/docs/config_guides/tracks#the-zoom-in-to-see-more-features-limits))

A badly bgzipped or indexed file usually throws an error rather than rendering
blank. A file the server re-encodes on the way out looks like corruption; see
[](/docs/config_guides/serving_data#indexed-binary-files-do-not-work-on-my-server).

## My tracks are blank or render incorrectly

If menus and track names look fine but features are missing, smeared, or the
wrong color, the drawing path is the likely cause.
[`&renderer=`](/docs/urlparams#renderer) pins which one is used:

- no parameter - WebGPU-first detection
- `?renderer=webgpu` - require WebGPU
- `?renderer=webgl` - WebGL2
- `?renderer=canvas2d` - software drawing

On JBrowse Desktop the same choice is the
[`--renderer` flag](/docs/quickstart_desktop#launching-from-the-command-line).

Please [open an issue](https://github.com/GMOD/jbrowse-components/issues) saying
which renderer worked, with your browser, operating system, graphics card, and
anything the developer console printed.

With many views open, the browser can hit its limit on live WebGL contexts and
take one back from a track, shown as a "WebGL context lost" banner. **Retry**
gets it back once another view has freed capacity, and **Use Canvas2D** switches
to software drawing for the rest of the session. Closing unused views also frees
contexts.

## Why is my track slow

For an indexed file, the time goes into fetching and decoding the region in
view. Deep alignment tracks at wide zoom dominate, and CRAM costs more CPU than
BAM to decode. The
[region size gate](/docs/config_guides/tracks#the-zoom-in-to-see-more-features-limits)
keeps a wide view from attempting this by accident.

Some adapters read a plain text file with no index (`Gff3Adapter`, `VcfAdapter`,
`BedAdapter`, `PAFAdapter`) and parse the whole file each time the track loads.
Converting to the bgzip and tabix indexed equivalent, or to
[PIF](/docs/developer_guides/pif_format) (`jbrowse make-pif`) for PAF, makes the
cost per-region. The cookbook's
[large alignments](/docs/cookbook#synteny-large-alignments) recipe covers the
synteny case.

Reads are many small range requests, so server latency counts for more than
bandwidth, and a server that ignores `Range` turns every read into a full
download. See [](/docs/config_guides/serving_data).

## My setting has no effect

JBrowse ignores a config key it does not recognize, so a misspelled slot loads
and does nothing. `jbrowse validate` catches exactly that; see
[checking a config](/docs/config_guides/intro#checking-a-config-with-jbrowse-validate).

## My saved session fails to load

A restored session looks its tracks up by `trackId`. Changing or deleting one
breaks every saved session that references it, the whole session and not just
that track. See
[keeping trackIds stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

## Where can I get help or report a bug

Post questions on the
[GitHub discussions board](https://github.com/GMOD/jbrowse-components/discussions)
or [contact us](/contact). Report bugs on
[GitHub issues](https://github.com/GMOD/jbrowse-components/issues).

## See also

- [](/docs/config_guides/serving_data)
- [](/docs/faq)
