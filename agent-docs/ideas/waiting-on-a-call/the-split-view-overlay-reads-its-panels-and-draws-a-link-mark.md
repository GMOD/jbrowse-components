---
name: the-split-view-overlay-reads-its-panels-and-draws-a-link-mark
description: The breakpoint split view refetches every variant track's records through its own RPC while it reads alignments straight off the display, and it draws its curves as hand-built SVG paths, the last connector ADR-225 left outside render-core's mark. Two convergences, each multi-day; the first retires an RPC and the overlay's whole fetch skeleton.
---

# The split view overlay reads its panels and draws a link mark

The breakpoint split view gets its two kinds of evidence two ways:

- **Reads** come off each panel's alignments display (`readSourceOf`), so the
  overlay draws what the pileup holds, filtered as the pileup is.
- **Variant records** come from `BreakpointGetFeatures`, a second RPC over the
  same file the variant display already fetched, run through `installFetch`
  with its own debounce, status chip, Retry notification and `reloadCounter`,
  and with the display's jexl filters threaded back in by hand
  (`overlayJexlFilters`).

The split view's two overlays draw SVG paths every frame. ADR-225 moved every other
connector onto render-core's `connector` mark and names this view as the one
still drawing them as SVG.

## Read the variant junctions off the display

The canvas variant display keeps a hit item (`FlatbushItem`) per record and
drops the feature, so the far end of a junction never reaches the main thread. Its worker already
has the feature, and `junctionEnds` (sv-core) answers for every record kind:
a VCF breakend, a symbolic SV with `END`/`CHR2`, and a paired adapter's row.

- The worker emits, beside each laid-out record that names a junction, its
  own end and its mate end as `{ refName, pos, keeps }`. Only junction-bearing
  records pay, and a callset is small next to a pileup.
- The split view reads them through the display, as it reads reads, and
  `getVariantJunctions` pairs them as now.
- `BreakpointGetFeatures`, the fetch skeleton in `model.ts`,
  `matchedTrackFeatures`, `fetchStatus`, the progress chip and the jexl
  re-threading all go. A variant curve can no longer disagree with the glyph
  under it about a filter, and it stops trailing the display by a fetch.
- Core's `mate` transform (`matedBy`, `featureTransforms.ts`) derives the same
  ends for the mark display's `link`. One derivation for both is the shape to
  aim at; check whether the transform can run in the variant worker before
  writing a second one.

Waits on a call that the canvas variant display grows a junction lane. The
payload change is the cost; measure it on a large SV callset
(`breast_cancer_sniffles_hg19`) before building.

## Draw the overlay through the link mark

The variant curve already copies the link mark's look (its default color,
breakend feet, the connector cubic), and the read curves compute their
control points through `bezierConnectorPath`, the connector shader's JS twin.

- One canvas over the stacked panels draws both through render-core, each
  instance placing its two feet through its own row's region table.
- Hover and click go through the mark's hit test, as `ArcHoverOverlay` does
  for the pileup, and the SVG export takes the mark's own export.
- `OverlayPaths`, `PathSpec` and the hit-stroke `<path>` per curve go.

A region table serves one view today, and a foot here can land in any row, so
the table needs a row index. Waits on a call that a mark may span views,
which the synteny view's ribbons would take too.
