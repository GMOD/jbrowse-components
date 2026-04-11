## Fix prettier config

- It is saving files with quote and added semicolons. See ~/src/mysetup.nvim

## Fix test errors, and simplify renderer config significantly

Jest tests fail, in plugins/canvas due to complexity and weird ness about the
'renderercontext' or 'configcontext'

## Dark reader doesn't look good sometimes

- with multiwiggle labels, it is white text on light background
- the dna letters are similar but it is white text on light color rects

## Occaisionally large inertia for scroll zoom

Particularly after navigating to another tab, then returning to app, and zooming

Unclear why...js is slower on returning to app? event not firing as fast on
return to app?

It is NOTICEABLY slow to start the scroll zoom (like almost 500ms or even 1s for
the scroll zoom to start)

Profiling is hard because affect goes away when profiler active?

Might need detailed debug logging

This is exotic but it also makes me wonder whether a more targetted 'mobx class
based' lineargenomeview model would help. We are expecting realtime performance
out of mobx-state-tree which is tricky

## Plan for test stability

Keep seeing test errors. Increasing test speed is extremely valuable also

## Plan for performance

Need to make sure we have top performance. Collect chrome performance profiling
traces

## Minimize bundle size

Try to measure where there is unnecessarily large bundles

## plugins/canvas sometimes doesn't render features on initial load

Can see feature labels and there are mouseover rects "work" but they are over
'blank' areas of the screen because the actual features did not get loaded

## Check that 'renderer' url param is working

Not sure if it is

## Add header to breakpoint split view

Should show coords

## Better design for human vs mouse style synteny

Need to design a system for good defaults

Look into circos, or other synteny plotting systems

## Also make it easier to just post arcs and coverage, no reads

Want to make it easy to plot megabase scale data

Possibly a custom regiontoolarge dialog

Remove snp level clickmap when zoomed out super far also, no reason for it

If possible, with arcs, try to aggregate them to add nice mouseover?

Another concept: presets, similar to old display mode

## Better 'blue/green' connectors in the breakpoint split view

Looks weird, arbitrarily increases in y (goes down), then loops back up. need
more ideal squiggle connector

## 1000 genomes demo

Add more metadata, change to a 'folder' by default

## Add global 'config overrides'

E.g. allow show paired arcs by default on by default across all tracks

## Add single cell demo

Get data from GEO or something Run pipeline ourselves Figure this out :)

## Dotplot not rendering

Lost context? maybe initially renders but not subsequently?

## Methylation mode not working

Check

## Potential improvements in type checking

An agent said the following, but i think we could improve the types if we tried:

- MultiSampleVariantGetCellData.ts line 27 — post-deserializeArguments cast;
  unavoidable because the base class return type is generic
- HtsgetBamAdapter.ts — pre-existing, unrelated to our work

The @ts-expect-error on dataAdapter.getSources() in
MultiSampleVariantGetSources.ts is also unavoidable — getSources is a method
specific to certain adapters, not on the BaseFeatureDataAdapter interface, so
there's no clean way to type it without touching the adapter base class.
