---
name: msa-pyrin-residues-reaim
description: Re-aim genomes_msa/pyrin_residues at the twelve-row ortholog alignment. The mechanism is found and the blocker is one shipped dependency release. Read before touching that figure or the msaview species list.
---

# Re-aiming `genomes_msa/pyrin_residues`

**State: blocked on a react-msaview release, everything else established.**
`genomes_msa/launch_sequence` is done and closed; this is its sibling.

## What broke it

`jbrowse-plugin-msaview` **2.8.0** widened the ortholog panel from 13 species to
23, which took the NLRP1 alignment from 5 rows to 12 — the review ask. It also
moved this figure's columns out from under it.

Measured on the twelve-row alignment, at the columns the view opens on
(`scrollX: 0`, colWidth 12):

| row                       | at the opening columns          |
| ------------------------- | ------------------------------- |
| western_lowland_gorilla   | full sequence (`MLNCAVLGGWCP…`) |
| horse                     | a short `MAAQDL`                |
| the other ten, QUERY too  | gap                             |

The cause is protein length: **gorilla 1556 aa, rhesus 1541, chimpanzee 1486
against the human query's 1473**, so column 0 is the longest protein's own
N-terminal extension and the human query's first residue is some way right of it.
The figure's whole point is the residues *under the pyrin block*, which is on the
query — so as captured it shows neither the pyrin columns nor a useful control.

Do not re-derive this by reading the picture: the long row at column 0 looks like
the query and is not. Crop the row labels and the residues at the same y
(`convert … -crop 1450x340+300+855`) before believing a row assignment.

## The fix, and why it is one release away

react-msaview's own gappyness control does exactly the right thing.
`GappynessSlider` is a MUI Slider, `min 1 max 100`, `value = allowedGappyness`,
100 = hide nothing. **PageDown steps it ten at once to 90**, and at twelve rows a
column present in only one row is 91.7% gaps (hidden) while a column present in
two is 83% (kept). So the private N-terminal extensions collapse and the shared
columns — including the pyrin ones — come to the left edge.

Two things had to be fixed to drive it, and both are done:

- **`.MuiSlider-thumb` is the wrong selector and fails silently.** The LGV above
  the MSA is a MUI Slider too (its zoom control), so the bare class matched that
  one and PageDown zoomed the genome view out to 103 kb. The capture still
  "succeeded" apart from a text wait.
- **react-msaview commit `7cd10eb`** (`~/src/react-msaview`, committed, NOT
  released) adds `data-testid="gappyness_slider"` to the Slider root. Target
  `[data-testid="gappyness_slider"] input` — the hidden range input MUI renders in
  the thumb is the node that takes focus and the keys. It is deliberately not
  `slotProps={{ input: … }}`: passing slotProps widens the Slider generic so
  `onChange`'s `val` infers as `number | number[]` and stops assigning to
  `setAllowedGappyness`.

## Definition of done

1. Release react-msaview (`pnpm release:patch` in `~/src/react-msaview`).
2. Bump `react-msaview` in `~/src/jb2plugins/jbrowse-plugin-msaview`, then
   `pnpm version patch` there — push first and let Integration go green, since
   `require-green-ci.mjs` gates on the exact commit. Then
   `cd ~/src/jbrowse-plugin-list && pnpm update-plugins && pnpm upload &&
   pnpm invalidate`, which is what actually moves the figure (the hosted
   `ucsc/hg38` config names the store's `latest/` url).
3. Put these actions back on `genomes_msa/pyrin_residues` in
   `website/scripts/specs/msa.ts`, after `SUBMIT_AND_WAIT`. They were written and
   then reverted rather than committed broken:

```ts
{ type: 'click', selector: '[data-testid="gappyness_slider"] input' },
{ type: 'press', key: 'PageDown' },
{ type: 'waitForText', text: 'Hide columns w/ >90% gaps' },
{ type: 'delay', ms: 1500 },
```

4. Capture, then **read the rows before writing the caption.** Then rewrite the
   "Checking it against the raw alignment" section of
   `website/docs/tutorials/genomes_msa.md`: it currently says this figure is a
   deliberately small five-species run, which is true of the committed PNG and
   will stop being true. The paragraph above it already states the new pyrin
   pattern (block on human, chimpanzee, gorilla and marmoset; the rhesus macaque
   is the annotated-but-not-called case), measured with the plugin's own CDD
   filter — Region features whose `db_xref` starts with `CDD:`. A grep for `PYD`
   in the GenPept XML hits every record and means nothing.
5. `pnpm figures:push --exact --filter genomes_msa/pyrin_residues`, then flip the
   review entry.

## Watch out

- **NCBI rate-limits eutils by IP (HTTP 429).** Probing accessions by hand and
  then capturing in the same few minutes makes the capture fail with the query
  protein missing. Leave a gap, or the run reports a broken selector when the real
  problem is the fetch.
- The domain **key** is clipped by the MsaView's own fixed height once twelve rows
  contribute enough distinct CDD domains. Raising the frame's `viewportHeight`
  only adds page background (measured: 1010 gave 128 css px of blank and the same
  clipping). Worth fixing in react-msaview — scroll or cap the key — rather than in
  the spec.
- The committed `pyrin_residues` PNG is the five-row one and is correct for the
  caption it currently has. If a run replaces it, restore with
  `rm website/static/img/genomes_msa/pyrin_residues.png && pnpm figures:pull`
  (pull skips a file that is already present, so the delete is required).
