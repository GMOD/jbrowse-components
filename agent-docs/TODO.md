## About track on reference sequence track shows weird 'array' representation of jexl, e.g.

See:

j 1 e 2 x 3 l 4

## Add git hash to version in about

Helps confirm dev builds are accurate

## Fix prettier config

- It is saving files with quote and added semicolons. See ~/src/mysetup.nvim

## Fix test errors, and simplify renderer config significantly

Jest tests fail, in plugins/canvas due to complexity and weird ness about the
'renderercontext' or 'configcontext'

## Dark reader doesn't look good sometimes

- with multiwiggle labels, it is white text on light background
- the dna letters are similar but it is white text on light color rects

## Opening gff in webgpu says error

[GPU] Using WebGPU renderer createHal.ts:23:17 [GPU] WebGPUHal.dispose() —
releasing GPU resources webgpuHal.ts:583:13 [GPU] Using WebGPU renderer
createHal.ts:23:17 Uncaptured WebGPU error: In a draw command, kind: Draw,
caused by: In bind group index 0, the buffer bound at binding index 1 is bound
with size 48 where the shader expects 64.

​

## Clickaway from features on vcf not working

should deselect feature

## No mouseover shading rect on green/purple vcf track

Mouseover shading does work on same data file without the green/purple

Works: volvox_filtered_vcf Fails: variant_colors

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

## WebGPU can 'freeze' despite loading initially

Saw a bunch of errors: GPU] Using WebGPU renderer 121[Buffer (unlabeled)] bound
with size 48 at group 0, binding 1 is too small. The pipeline ([RenderPipeline
(unlabeled)]) requires a buffer binding which is at least 64 bytes. This binding
is a uniform buffer binding. It is padded to a multiple of 16 bytes, and as a
result may be larger than the associated data in the shader source.

- While encoding [RenderPassEncoder (unlabeled)].Draw(6, 1, 0, 0).
- While finishing [CommandEncoder (unlabeled)]. Understand this warning
  250[Invalid CommandBuffer] is invalid due to a previous error.
- While calling [Queue].Submit([[Invalid CommandBuffer]]) Understand this
  warning 21[Buffer (unlabeled)] bound with size 48 at group 0, binding 1 is too
  small. The pipeline ([RenderPipeline (unlabeled)]) requires a buffer binding
  which is at least 64 bytes. This binding is a uniform buffer binding. It is
  padded to a multiple of 16 bytes, and as a result may be larger than the
  associated data in the shader source.
- While encoding [RenderPassEncoder (unlabeled)].Draw(6, 2, 0, 0).
- While finishing [CommandEncoder (unlabeled)]. Understand this warning
  25[Buffer (unlabeled)] bound with size 48 at group 0, binding 1 is too small.
  The pipeline ([RenderPipeline (unlabeled)]) requires a buffer binding which is
  at least 64 bytes. This binding is a uniform buffer binding. It is padded to a
  multiple of 16 bytes, and as a result may be larger than the associated data
  in the shader source.
- While encoding [RenderPassEncoder (unlabeled)].Draw(6, 3, 0, 0).
- While finishing [CommandEncoder (unlabeled)]. Understand this warning
  65[Buffer (unlabeled)] bound with size 48 at group 0, binding 1 is too small.
  The pipeline ([RenderPipeline (unlabeled)]) requires a buffer binding which is
  at least 64 bytes. This binding is a uniform buffer binding. It is padded to a
  multiple of 16 bytes, and as a result may be larger than the associated data
  in the shader source.
- While encoding [RenderPassEncoder (unlabeled)].Draw(6, 19, 0, 0).
- While finishing [CommandEncoder (unlabeled)]. Understand this warning
  18[Buffer (unlabeled)] bound with size 48 at group 0, binding 1 is too small.
  The pipeline ([RenderPipeline (unlabeled)]) requires a buffer binding which is
  at least 64 bytes. This binding is a uniform buffer binding. It is padded to a
  multiple of 16 bytes, and as a result may be larger than the associated data
  in the shader source.
- While encoding [RenderPassEncoder (unlabeled)].Draw(6, 7, 0, 0).
- While finishing [CommandEncoder (unlabeled)]. Understand this warning
  webgl-poc/?config=test_data%2Fvolvox%2Fconfig.json&session=local-Lg97yXA8cb&renderer=canvas:1
  WebGPU: too many warnings, no more warnings will be reported to the console
  for this GPUDevice.Understand this warning

## Does reference sequence track need to be webgl rendered?

Might not need to be?

## Right click in track area does not give default browser context menu

Just swallows the click event and does nothing. Right click outside the track
area works

## Check that 'renderer' url param is working

Not sure if it is

## Check track height calculations in export svg

Tracks are overlapping slightly, particular feature label from a gff above
overlapping onto e.g. bigwig track below

The variant rects are very thin also, check MIN feature rect width. was changed
to '4' in the shaders but not sure canvas was updated

## Breakpoint split view 'green connector' from translocation can get stuck in hover state?A

After mouseover and 'hovering' it, then side wheel scroll, stays mouseovered
even though not under mouse

Might be complicated issue?

## Add header to breakpoint split view

Should show coords

## Dotplot scroll zoom too fast

Needs to be a bit slower

## Synteny blanks entirely during scroll due to 'loading'

Should just show a 'loading overlay' rather than fully blanking

The 'scroll zoom' on the synteny area is not zooming in either

## Better UI for 'add multiple'

It is confusing

Should make it more clear that there is like a 'pangenome launcher' or
multisyntenyview shouldeven be separate view type

## Better design for human vs mouse style synteny

Need to design a system for good defaults

Look into circos, or other synteny plotting systems

## Reads plotted as brown unexpectedly

Mate unmapped?

## Remove gap between paired read arcs and coverage track

Also add option to let sashimi arcs plot over the coverage track (not upside
down)

Slightly more bezier points?

Also make it easier to just post arcs and coverage, no reads

Want to make it easy to plot megabase scale data

Possibly a custom regiontoolarge dialog

Remove snp level clickmap when zoomed out super far also, no reason for it

If possible, with arcs, try to aggregate them to add nice mouseover?

## Better 'blue/green' connectors in the breakpoint split view

Looks weird, arbitrarily increases in y (goes down), then loops back up. need
more ideal squiggle connector

## UCSC Adapter on CpG track in methylation demo

Fetch failed: TypeError: Cannot read properties of undefined (reading 'trim') at
i (9912.c3323e7c.chunk.js:27:7457) at l (9912.c3323e7c.chunk.js:27:7680) at S
(241.072c4210.chunk.js:1:3035) at A (241.072c4210.chunk.js:1:6387) at
241.072c4210.chunk.js:1:16667 at 241.072c4210.chunk.js:1:16685 at Pe
(7866.1744ea3f.chunk.js:1:17069) at J (241.072c4210.chunk.js:1:16408)

## 1000 genomes demo

Add more metadata, change to a 'folder' by default

## Smaller paired-arcs by default

e.g. 20px only really

## Paired-arcs slightly darker colors for both red (larger insert size) and grey (normal) than expected

Not sure why. We have run into this several times before, please check the
coloring algorithm

It almost looks like every paired arc has a little 'outline' which darkens it

## Add global 'config overrides'

E.g. allow show paired arcs by default on by default across all tracks

## Add single cell demo

Get data from GEO or something Run pipeline ourselves Figure this out :)
