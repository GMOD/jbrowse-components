# Take: fold the transcript

A gene in the browser, and next to it a structure of the protein that this very
transcript encodes, folded during the take rather than fetched. Then the same
for the sickle variant, and the question a viewer would ask: did the fold move.
The answer is no, and that null is the point of the last turn.

```
node scripts/agent-demos/agentDemo.mjs out/protein scripts/agent-demos/takes/protein.mjs
```

Shoot this one first. Every outside step is seconds long, and nothing has to be
pre-staged.

## The turns

- Open hg38 at HBB, with genes and ClinVar.
- Fold this transcript's own translation with ESMFold, not the UniProt model,
  and connect the structure to the gene.
- Fold the sickle variant too and put the two side by side.
- Did the fold change? Show me where the variant sits on the structure.

## What a good take does

**Turn one** is the hosted hg38 config, `HBB` through the text index, and two
tracks: `hg38-ncbiRefSeqCurated` (or `hg38-ncbiRefSeq`) and `hg38-clinvarMain`.
The hosted config lists the Protein3d plugin, so the ProteinView type exists as
soon as the config loads.

**Turn two** is the demo. The transcript comes out of the app, not out of NCBI,
and the hosted RefSeq track hands back a gene with its transcripts nested one
level down, so the transcript is a subfeature, not a feature:

```js
const feats = await jb.getFeatures({
  trackId: 'hg38-ncbiRefSeqCurated',
  loc: 'chr11:5,225,464-5,227,071',
})
const gene = feats.map(f => f.toJSON()).find(j => j.gene_id === 'HBB')
const tx = gene.subfeatures.find(t => t.transcript_id === 'NM_000518.5')
globalThis.tx = tx
return tx.subfeatures
  .filter(s => s.type === 'CDS')
  .map(s => [s.start, s.end, s.phase])
```

An agent that filters the top level on `name` gets one feature named `null` and
concludes the track is empty; that happened in the trial. The transcript carries
`exon`, `CDS`, `start_codon` and `stop_codon` subfeatures, and its three CDS
pieces are `5225600-5225726`, `5226576-5226799` and `5226929-5227021` (0-based
half-open). NM_000518.5 is on the minus strand; the CDS runs
`chr11:5,225,601-5,227,021` in 1-based terms. Translating the CDS subfeatures
against the assembly sequence, reverse-complemented, gives 147 residues, and
that string equals NP_000509.1 exactly. This was checked from the same
coordinates outside the app:

```python
import json, urllib.request

CODON = {}
aas = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG'
i = 0
for a in 'TCAG':
    for b in 'TCAG':
        for c in 'TCAG':
            CODON[a + b + c] = aas[i]
            i += 1
COMP = str.maketrans('ACGT', 'TGCA')

def translate_cds(cds):
    prot = ''.join(CODON[cds[j:j + 3]] for j in range(0, len(cds) - len(cds) % 3, 3))
    return prot.rstrip('*')

# feature: the toJSON() of the transcript, seq: genome sequence over txStart..txEnd
def cds_of(feature, seq, seq_start):
    parts = sorted(
        (s['start'], s['end']) for s in feature['subfeatures'] if s['type'] == 'CDS'
    )
    cds = ''.join(seq[s - seq_start:e - seq_start] for s, e in parts)
    return cds.translate(COMP)[::-1] if feature['strand'] == -1 else cds
```

The fold is one POST, no key, well under the MCP call timeout:

```bash
curl -s -X POST --data "$PROTEIN" https://api.esmatlas.com/foldSequence/v1/pdb/ > hbb_wt.pdb
python3 -m http.server 8765 &
```

Then the explicit-form ProteinView, which is the plugin's documented spec for a
transcript that no loaded track has to serve (`DEVELOPERS.md` in
jbrowse-plugin-protein3d, "Explicit form"):

```js
await jb.loadSessionSpec({
  views: [
    {
      type: 'ProteinView',
      url: 'http://localhost:8765/hbb_wt.pdb',
      userProvidedTranscriptSequence: protein,
      feature: tx,
      displayName: 'HBB, ESMFold from NM_000518.5',
      connectedView: {
        assembly: 'hg38',
        loc: 'chr11:5,225,464-5,227,071',
        tracks: ['hg38-ncbiRefSeqCurated', 'hg38-clinvarMain'],
      },
    },
  ],
})
```

The Desktop renderer runs with `webSecurity: false`
(`products/jbrowse-desktop/electron/window.ts`), so a localhost URL is fetchable
without CORS headers. In the Desktop trial the structure loaded from that URL
and `genomeToTranscriptSeqMapping` put residue index 6 at `chr11:5,227,002`,
which is rs334. Three things the trial found that the plugin docs do not say:

- `displayName` on a connected ProteinView spec names the **genome view** it
  creates; the ProteinView itself comes up "Untitled view" until
  `view.setDisplayName(...)`.
- A spec `layout` indexes the spec's own `views` only. The connected genome view
  is created beside entry 0 and is not an index, so two ProteinViews are
  `[{ views: [0] }, { views: [1] }]`, and a `views: [2]` fails with "Session
  spec layout references view index 2, but the spec has 2 view(s)" and leaves an
  empty panel.
- `jb.loadSessionSpec` returns the connected genome view's id, not the
  ProteinView's; find the ProteinView through `session.views` by type.

**Turn three** has a numbering trap the agent has to get right on camera. The
sickle mutation is "E6V" in the literature because mature hemoglobin is numbered
without the initiator methionine. ClinVar's HGVS on NP_000509.1 is p.Glu7Val,
and in the translated string it is index 6, the seventh residue: `MVHLTPE` then
`E`. The nucleotide change is rs334, `chr11:5,227,002 T>A` on hg38 (c.20A>T). A
take that mutates residue 6 replaces a proline and folds the wrong protein while
looking exactly as confident. The second fold gets its own ProteinView, and a
`layout` with `direction: 'horizontal'` puts the two structures beside each
other.

**Turn four** asks for a comparison, and the honest answer is that nothing
moved. Kabsch superposition of the CA atoms of the two ESMFold outputs:

```
residues 147   CA RMSD 0.01 A
mean pLDDT     wt 0.942   mut 0.943
largest CA displacement 0.04 A (Leu4)
residues moving more than 1 A: 0
```

That is what a single-sequence structure predictor says about a surface
substitution on the A helix, and it is correct as far as it goes: sickling is a
property of the tetramer, where Val7 makes a hydrophobic patch that docks into a
pocket on a neighbouring molecule and the fibre grows from there. A monomer fold
cannot show that, and the agent should say so rather than hunt for a difference.
The visual payoff is the connection instead: hover the ClinVar variant at
chr11:5,227,002 and residue 7 lights on both structures; click residue 7 and the
codon highlights in the gene.

The superposition is a dozen lines with numpy, which the default `python3` on
this machine does not have; the agent makes a venv, and that is fine on camera:

```python
import sys
import numpy as np

def ca_atoms(path):
    xyz, plddt, names = [], [], []
    for line in open(path):
        if line.startswith('ATOM') and line[12:16].strip() == 'CA':
            xyz.append([float(line[30:38]), float(line[38:46]), float(line[46:54])])
            plddt.append(float(line[60:66]))
            names.append(line[17:20] + str(int(line[22:26])))
    return np.array(xyz), np.array(plddt), names

def superpose(P, Q):
    Pc, Qc = P - P.mean(0), Q - Q.mean(0)
    U, _, Vt = np.linalg.svd(Pc.T @ Qc)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    R = Vt.T @ np.diag([1, 1, d]) @ U.T
    return (R @ Pc.T).T, Qc

wt, wt_plddt, names = ca_atoms(sys.argv[1])
mut, mut_plddt, _ = ca_atoms(sys.argv[2])
a, b = superpose(wt, mut)
per_res = np.linalg.norm(a - b, axis=1)
print(f'CA RMSD {np.sqrt((per_res ** 2).mean()):.2f} A over {len(wt)} residues')
for i in np.argsort(-per_res)[:5]:
    print(f'{names[i]:>7} {per_res[i]:.2f} A')
```

## Verified before this was written

| Claim                                    | How                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Hosted hg38 has ClinVar and the plugin   | `hg38-clinvarMain` in the track list; `Protein3d` in the config's `plugins`                                      |
| Translation of the CDS is NP_000509.1    | 444 nt, 147 aa, string equality against the RefSeq protein                                                       |
| ESMFold answers quickly                  | a 47-mer in 0.8 s; the two 147-mers from the earlier check are 1130 and 1128 atoms                               |
| Both folds have residue 7 right          | `GLU7` in the wild type PDB, `VAL7` in the variant                                                               |
| The fold does not change                 | CA RMSD 0.01 A, pLDDT 0.94 on both, no residue over 0.04 A                                                       |
| Localhost fetch is not blocked by policy | `webSecurity: false` in the Desktop window options                                                               |
| It renders in Desktop                    | four MCP trials against the built app; both folds drawn, connected view wired, residue 7 maps to chr11:5,227,002 |

## Rehearsal, 2026-09-01

Shot once through the harness. `protein-take1-transcript.txt` beside this file
is the turn-by-turn record; the clip and poster are
`website/static/media/mcp/agent_protein_take1.*` (gitignored, 134 s after
`encode.mjs`).

| Turn                 | Wall  | Outcome                                                                                    |
| -------------------- | ----- | ------------------------------------------------------------------------------------------ |
| open at HBB          | 74 s  | three tracks, heights fitted                                                               |
| fold the transcript  | 416 s | translation equal to NP_000509.1, ESMFold, served, connected; mapping verified live        |
| sickle, side by side | 568 s | residue 7 and rs334 pinned from the live mapping and ClinVar; 9 of those minutes on layout |
| did the fold change  | 248 s | CA RMSD 0.011 A, residue 7 marked on both, genome view on the codon                        |

Every substantive answer was right, and the agent found the explicit-form keys
by introspecting a bare `addStructure({})` rather than from any document. The
time went to three things the app made hard, all worth fixing before the next
take rather than coaching around:

- **`ProteinView` is not in the bundled docs.** `docs topic:"model:ProteinView"`
  has nothing, and the session-spec page does not carry the explicit form, so
  the agent read the plugin off the live MST tree. `typeDocs.generated.json`
  covers in-tree types only.
- **The live `applyLayoutSpec` takes `viewIds`, the spec `layout` takes `views`
  indexes.** The agent passed `{ views: [1] }` to the action, which accepted it
  and collapsed the workspace into one tab; recovering took several calls and
  one `resetUseWorkspaces`. `moveViewToSplitRight(viewId, allViewIds)` was tried
  with one argument. Both are silent-wrong-shape failures of the kind
  `agents_live_model.md` warns about for display settings.
- **The connected genome view is not a layout index**, so the agent's first
  correct-looking spec left an empty panel; see the layout note above.

## Open

- The turn-four phrasing. "Which residues moved" invites the agent to
  manufacture a difference. "Did the fold change" lets the null be the answer.
  Keep the second form.
