---
name: msa-pyrin-residues-reaim
description: Re-aim genomes_msa/pyrin_residues at the twelve-row ortholog alignment. The dependency releases are DONE and shipped; what is left is one plugin release and rewriting the spec declaratively. Read before touching that figure or the msaview species list.
---

# Re-aiming `genomes_msa/pyrin_residues`

**State: the blocker is gone. The releases are out, the declarative mechanism is
written and pushed, and what remains is one `pnpm version patch` plus the spec
rewrite.** `genomes_msa/launch_sequence` is done and closed; this is its sibling.

## What broke it

`jbrowse-plugin-msaview` **2.8.0** widened the ortholog panel from 13 species to
23, which took the NLRP1 alignment from 5 rows to 12 — the review ask. It also
moved this figure's columns out from under it.

Measured on the twelve-row alignment, at the columns the view opens on
(`scrollX: 0`, colWidth 12):

| row                      | at the opening columns          |
| ------------------------ | ------------------------------- |
| western_lowland_gorilla  | full sequence (`MLNCAVLGGWCP…`) |
| horse                    | a short `MAAQDL`                |
| the other ten, QUERY too | gap                             |

The cause is protein length: **gorilla 1556 aa, rhesus 1541, chimpanzee 1486
against the human query's 1473**, so column 0 is the longest protein's own
N-terminal extension and the human query's first residue is some way right of it.
The figure's whole point is the residues _under the pyrin block_, which is on the
query — so as captured it shows neither the pyrin columns nor a useful control.

Do not re-derive this by reading the picture: the long row at column 0 looks like
the query and is not. Crop the row labels and the residues at the same y
(`convert … -crop 1450x340+300+855`) before believing a row assignment.

## The fix: `allowedGappyness`, and it is now declarative

At twelve rows a column present in one row is 91.7% gaps and a column present in
two is 83%, so **`allowedGappyness: 90` collapses the private N-terminal
extensions and brings the shared columns — the pyrin ones among them — to the
left edge.** `hideGaps` already defaults to `true`, so that one number is enough;
`hideGapsEffective` is `hideGaps && (collapsed.length > 0 || allowedGappyness <
100)`.

**Do not drive the slider.** That route was tried and is a dead end worth not
repeating: `[data-testid="gappyness_slider"] input` + `PageDown` reached the
control (the testid ships in react-msaview 5.7.2) but the run still failed on
`waitForText "Hide columns w/ >90% gaps"` — the keypress did not move the value.
The declarative route below replaced it before that was diagnosed, and the
review asked for exactly that ("it would be ideal to try to declaratively
specify this setting"). For the record on why the testid exists at all: a bare
`.MuiSlider-thumb` matches the LGV's zoom control, which comes first in the
document, so the old selector silently zoomed the genome view to 103 kb while
the capture still "succeeded".

## Shipped already (do not redo)

- **react-msaview 5.7.2** — on npm, tagged, CI green. Adds
  `data-testid="gappyness_slider"`.
- **jbrowse-plugin-msaview 2.8.1** — on npm; `host-compat` green on v4.0.0,
  v4.3.0, latest and main.
- **The plugin store carries it.** `pnpm dep` in `~/src/jbrowse-plugin-list`,
  then `pnpm invalidate`. Verified live: the `latest/` bundle contains
  `gappyness_slider` and its etag matches the uploaded file byte-for-byte.
  - Two things to know about that run. It promoted **jbrowse-plugin-tview
    2.0.6 → 2.2.0** as well — `update-plugins` promotes every plugin with a
    newer npm release, and both went through `verify`. And the `Updates` commit
    landed on the branch that checkout was on, **`retire-v5-incompatible-plugins`,
    not `main`**; the S3 upload is independent of the branch, so the store is
    correct, but that commit wants merging.
  - **A capture run immediately after `invalidate` fails.** The first one did,
    with `Unexpected token ')'` and `JBrowsePluginMsaView is undefined` — the
    edge served a partial object mid-invalidation. It is not an ABI problem and
    not the bundle. Re-run.

## What is left

### 1. Release the declarative launch

`~/src/jb2plugins/jbrowse-plugin-msaview` commit **`7c8c501`** (pushed, NOT
released) makes `LaunchView-MsaView` take `orthologParams` as a fourth alignment
source, so the Orthologs tab is reachable from a session spec. Two fields
default so a spec can be short:

- `taxa` omitted → every species the dialog offers (`COMMON_SPECIES`).
- `proteinSequence` omitted → NCBI's representative protein for the resolved
  gene. The dialog still supplies the user's own translated transcript, because
  that is what `connectedFeature` maps genome coordinates through; a spec has no
  transcript to translate and should not carry ~1.5 kB of residues in a url. A
  query row taken from the representative protein also passes the byte-identity
  test that attaches `Accession`, so the CDD overlay is there by construction —
  which matters, because `SUBMIT_AND_WAIT` gates on `Pyrin_NALPs`.

It typechecks, lints and passes the plugin's 89 tests, but **nothing has run it
end to end.** Do that first — a session spec against a local jbrowse-web is
enough — then:

```
cd ~/src/jb2plugins/jbrowse-plugin-msaview
pnpm version patch                       # preversion runs check-ci, lint, build, host-compat
cd ~/src/jbrowse-plugin-list && pnpm dep && pnpm invalidate
```

`check-ci` gates on Integration being green for the exact commit, so let the
push settle first. Then leave a gap before capturing, per the invalidation note
above.

### 2. Rewrite the spec

`website/scripts/specs/msa.ts`, `genomes_msa/pyrin_residues`. It is currently the
committed dialog-driven version with no gappyness step, which is correct for the
committed five-row PNG. The declarative replacement is a session spec with no
actions at all — no right-click, no dialog, no `SUBMIT_AND_WAIT`:

```ts
url: sessionSpec(UCSC_HG38_CONFIG, {
  views: [
    { type: 'LinearGenomeView', assembly: 'hg38', loc: NLRP1_WINDOW, tracks: [...] },
    {
      type: 'MsaView',
      orthologParams: { taxId: 9606, geneCandidates: ['NLRP1'], msaAlgorithm: 'clustalo' },
      allowedGappyness: 90,
      colWidth: 12,
      rowHeight: 12,
      drawNodeBubbles: true,
    },
  ],
}),
```

Keep a `waitForText` on `Pyrin_NALPs` as the readiness gate — it is the only
thing that proves NCBI answered the human record rather than 429ing, and a frame
without it is an overlay missing the one block the page is about. Check
`msaAlgorithm`'s accepted values against `MsaAlgorithm` before writing it down.

### 3. Then

**Read the rows before writing the caption.** Then rewrite the "Checking it
against the raw alignment" section of `website/docs/tutorials/genomes_msa.md`: it
currently says this figure is a deliberately small five-species run, which is
true of the committed PNG and stops being true. The paragraph above it already
states the new pyrin pattern (block on human, chimpanzee, gorilla and marmoset;
the rhesus macaque is the annotated-but-not-called case), measured with the
plugin's own CDD filter — Region features whose `db_xref` starts with `CDD:`. A
grep for `PYD` in the GenPept XML hits every record and means nothing.

Finish with `pnpm figures:push --exact --filter genomes_msa/pyrin_residues` and
flip the review entry.

## Watch out

- **NCBI rate-limits eutils by IP (HTTP 429).** Probing accessions by hand and
  then capturing in the same few minutes makes the capture fail with the query
  protein missing. Leave a gap, or the run reports a broken selector when the
  real problem is the fetch.
- The domain **key** is clipped by the MsaView's own fixed height once twelve
  rows contribute enough distinct CDD domains. Raising the frame's
  `viewportHeight` only adds page background (measured: 1010 gave 128 css px of
  blank and the same clipping). Worth fixing in react-msaview — scroll or cap the
  key — rather than in the spec.
- The committed `pyrin_residues` PNG is the five-row one and is correct for the
  caption it currently has. If a run replaces it, restore with
  `rm website/static/img/genomes_msa/pyrin_residues.png && pnpm figures:pull`
  (pull skips a file that is already present, so the delete is required).
