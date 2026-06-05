- regenerate embedded examples
- circular view filter sv types/sv-inpector filterings
- hic testing
- reversed region testing
- hide sashimi arcs if not relevant?
- show coverage hides arcs even when 'below'...
- make samplot mode have better coloring (same as arcs essentially)
- show outlines autohide
- when vertical scrolling, weird behavior that kind of scrolls the page too fast when you just want to scroll element
- more 'group operations'
- fullpage_arcs-collapse-introns-sashimi.png need to scroll down to see the collapsed arcs
- does yeast demo really need remote
- no max height react-app
- persistent no-close cascading submenu for subselectingmultiple items

mouseover highlight read

Let me check how highlightBoxes is wired and what the chevron geometry actually requires, to judge the real complexity.

  Searched for 1 pattern, read 1 file

I've now traced the whole path. Here's my honest complexity verdict.

The shape itself is easy. The body+chevron is just a 5-point pentagon (an arrow/"home-plate" shape), and a <div> with clip-path: polygon(...) does it natively — no SVG needed. For a forward-strand read whose body width is w:

clip-path: polygon(0 0, {w}px 0, 100% 50%, {w}px 100%, 0 100%)   // tip on right
with the div's width extended by the 8px chevronClip. Reverse strand is the mirror (tip on left).    Threading strand in is free — readSdata right next toreadPositions/readYs, so computeHighlightBoxes just reads rpcData.readStrands[entry.idx] and emits a clipPath string per box.
                                                                                                    So the geometry + plumbing is ~30–4htBoxes.ts and HighlightOverlay.tsx. Not excessive.
The one genuinely fiddly part is that the shader doesn't always draw a chevron. read.slang gates it on showChev:
                                                                                                    baseShow = (chainMode || pxPerBp >
dirMoot  = colorScheme==NORMAL || mateUnmapped                                                      showChev = baseShow && (!dirMoot ||
                                                                                                    To be pixel-exact — i.e. the shadedreal chevron is under the cursor —the overlay has to replicate that predicate (needs pxPerBp, chainMode, colorScheme, featHeight, the read's mate-unmapped flag and on-scng shader logic that could driftlater, so it'd want a SYNC comment. If we skip it, the highlight would sometimes show a chevron tailon a read that's currently rendered out, or narrow normal-schemereads) — a visible mismatch.
My recommendation: the gating is the only reason this is "moderate" rather than "trivial." It's not excessive — maybe 50–60 lines totald and a SYNC note. The real caveatis chain/linked-read hover, which collapses several reads into one min/max span with no single strand; I'd keep those rectangular ngle-read hover (the overwhelminglycommon case).


- chevrons canvas2d



Chevron arrow hiding → N/A on Canvas2D — because Canvas2D never draws the arrows in the first place. As you can see above, drawReads only paints fillRect (the read body) + an optional strokeRect outline. There are no chevron triangles at all. So all my arrow gating (dirMoot, pairTooTight, interchrom width thresholds) is inherently GPU-only — there's nothing to hide on the Canvas2D side. This is a pre-existing divergence, not something my changes introduced.

Practical implications:
- Normal browser use runs the GPU bers see the arrows and all the newgating.
- The Canvas2D fallback (no-WebGL ert path go through drawReads → sothey show no strand arrows at all, today and before my change.

So nothing is broken — but if you want true parity, the missing piece is adding chevron drawing to
Canvas2D drawReads (and it would mo That's a self-contained addition:port the same showChev logic (the baseShow/dirMoot/pairTooTight conditions are all computable from
the per-read arrays already in Draw triangle path at the read'sleading/trailing edge.

Want me to add Canvas2D/SVG arrows so the two backends match? Or leave Canvas2D as rects-only (it's
been that way and is fine for the f

✻ Churned for 33s

❯ yes please

I'll add chevron drawing to the Canrstand the available state — thecolorScheme representation, whether pxPerBp is accessible, and the GPU geometry to mirror:

  Read 1 file, ran 1 shell command

colorScheme is a number (CS_NORMAL = 0). Let me find the enum mapping and confirm pxPerBp
derivation:

  Ran 1 shell command

There's a ColorScheme enum in const

  Ran 1 shell command

ColorScheme.normal = 0. Now let me see (SvgCanvas/Ctx2D) supports pathoperations (beginPath/lineTo/fill), since I'll draw the arrow as a path:

  Ran 4 shell commands

SvgCanvas supports full path ops (beginPath/moveTo/lineTo/closePath/fill/stroke), so a path-based arrow renders in both real-canvas apToScreenX to handle coordinate/flip correctly:

- long range arcs should tend to just go vertical...if not in view, just go more towards semicircle style
