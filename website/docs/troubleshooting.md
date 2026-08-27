---
title: Troubleshooting
description:
  Diagnosing a track that is empty, blank, slow, or a session that will not
  restore
---

## My track loads but shows no features

The track turns on without an error but stays empty where you expect data. The
usual cause is a reference name mismatch — the file names its chromosomes
differently than the assembly (`chr1` vs `1`, or `NC_000001.11` vs `chr1`) — and
[reference name aliasing](/docs/config_guides/assemblies#configuring-reference-name-aliasing)
covers how to confirm that from the "About track" dialogs and how to map the two
naming schemes together.

A few other things worth checking:

- you're not zoomed into a region that simply has no data there
- there isn't a "Zoom in to see features" message showing (see
  [the region limits](/docs/config_guides/tracks#the-zoom-in-to-see-more-features-limits))

A file that's bgzip compressed or tabix/CSI indexed incorrectly usually throws
an error rather than rendering blank. A file the server re-encodes on the way
out looks like corruption instead, see
[](/docs/config_guides/serving_data#indexed-binary-files-do-not-work-on-my-server).

## My tracks are blank or render incorrectly

If the menus and track names look fine but the features themselves are missing,
smeared, or the wrong color, the drawing path is the likely cause.
[`&renderer=`](/docs/urlparams#renderer) pins which one is used, so you can try
each in turn:

- no parameter - the usual WebGPU-first detection
- `?renderer=webgpu` - require WebGPU
- `?renderer=webgl` - WebGL2
- `?renderer=canvas2d` - software drawing

On JBrowse Desktop the same choice is the
[`--renderer` flag](/docs/quickstart_desktop#launching-from-the-command-line).

That identifies where the problem is, so please
[open an issue](https://github.com/GMOD/jbrowse-components/issues) noting which
of the three worked, along with your browser, operating system and graphics
card. Graphics errors are printed to the browser's developer console, so include
anything there.

With many views open, the browser can hit its limit on live WebGL contexts
(Chrome allows about 16) and take one back from a track, which shows as a "WebGL
context lost" banner there. Retry gets it back if another view has since freed
capacity, and the banner's **Use Canvas2D** button switches drawing to software
for the rest of the session: slower on dense data, unaffected by how many views
are open. Closing views you aren't using also frees contexts.

## Why is my track slow

For an indexed file, the time goes into fetching and decoding the region in
view. Deep alignment tracks at wide zoom levels dominate, with thousands of
reads to download, decode and lay out. CRAM costs more CPU to decode than BAM,
being reference-compressed. The
[region size gate](/docs/config_guides/tracks#the-zoom-in-to-see-more-features-limits)
is what keeps a wide view from attempting this by accident.

Some adapters read a plain text file with no index (`Gff3Adapter`, `VcfAdapter`,
`BedAdapter`, `PAFAdapter`). These parse the whole file each time the track
loads, which is reasonable for a small file. Converting to the bgzip and tabix
indexed equivalent, or to [PIF](/docs/developer_guides/pif_format)
(`jbrowse make-pif`) for PAF, changes the cost from whole-file to per-region.
The cookbook's [large alignments](/docs/cookbook#synteny-large-alignments)
recipe covers the synteny case.

Server behavior matters as well. Reads are many small range requests, so latency
counts for more than bandwidth, and a server that ignores `Range` and returns
whole files turns every read into a full download. See
[](/docs/config_guides/serving_data).

## My setting has no effect

JBrowse ignores a config key it does not recognize rather than reporting it, so
a misspelled slot loads and does nothing. `jbrowse validate` catches exactly
that, see
[checking a config](/docs/config_guides/intro#checking-a-config-with-jbrowse-validate).

## My saved session fails to load

A restored session looks its tracks up by `trackId`, and changing or deleting
one breaks every saved session that references it — the whole session fails, not
just that track. See
[keeping trackIds stable](/docs/config_guides/deploying#keep-trackids-stable-for-reproducible-links).

## Where can I get help or report a bug

Post questions on the
[GitHub discussions board](https://github.com/GMOD/jbrowse-components/discussions)
or [contact us](/contact). To report a bug, open an issue on
[GitHub](https://github.com/GMOD/jbrowse-components/issues).

## See also

- [](/docs/config_guides/serving_data)
- [](/docs/faq)
