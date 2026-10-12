---
name: a-union-axis-for-the-ecoli-pangenome
description: odgi flatten over a K12-anchored node order gives the E. coli pggb graph an 8.3 Mb union axis where every strain's islands have width; it reproduces Perna 2001's O-islands/K-islands and shows IAI39's inversions on one assembly. Stock odgi sorts leave a sawtooth or dump off-K12 nodes at the end, so it needs a 25-line order script.
---

# A union axis for the E. coli pangenome

Every presence track in the pangenome tutorials is projected onto a reference,
so `odgi pav` over K12 windows cannot draw sequence K12 lacks. A union axis
gives that sequence width: one assembly holding each graph node once, with a
presence row per strain.

**Spike, 2026-10-12**, on the 2026-10-11 pggb rebuild
(`ada:~/data/ecoli-pggb-rebuild-2026-10-11/build/pggb/*.smooth.final.og`, odgi
0.9.4):

- `odgi flatten -f pan.fa -b pan.bed` takes 1.7 s. The union is 8.34 Mb against
  genomes of 4.6-5.5 Mb; 3.7 Mb of it is absent from K12, 738 kb of that shared
  by two or more other strains.
- On the anchored order below, Sakai has 1.27 Mb K12 lacks and K12 has 0.44 Mb
  Sakai lacks (runs >= 50 bp). Perna et al. 2001 counted 1.34 Mb of O-islands
  and 0.53 Mb of K-islands between O157 EDL933 and K12, and the axis shows the
  same split.
- Plotted as strain position against union position, all five strains run on
  one diagonal. IAI39's inversions near union 3.3-4.3 Mb and 7.0-7.3 Mb draw as
  anti-diagonals, and prophage copies as off-diagonal marks.

**The node order is the work.** Three orders were tried:

- pggb's own `-p Ygs` sort, and the same after `odgi groom`: a sawtooth of
  blocks, every other one reversed against every genome, so a gene reads
  backwards on half the axis. 57-60% of each strain's steps go left.
- `odgi sort -p Ygs -H k12.txt` after `odgi groom -R k12.txt`: K12's nodes come
  out monotone, but SGD has no terms for the 0.9 Mb no K12 path touches and
  leaves it past 7.45 Mb, away from its flanks.
- An explicit order through `odgi sort -s order.txt`: each K12 node keyed by
  K12's first visit, each other node slotted after the last K12 node its walk
  passed, with the walk's bp offset breaking ties. K12 steps never go left;
  the others go left 2-3% of steps (IAI39 30%, its inversions).

```python
seglen, paths = {}, {}
for line in open(gfa):
    if line[0] == 'S':
        _, i, s = line.split('\t')[:3]
        seglen[int(i)] = len(s.strip())
    elif line[0] == 'P':
        _, n, steps = line.split('\t')[:3]
        paths[n.split('#')[0]] = [int(x[:-1]) for x in steps.split(',')]
key, pos = {}, 0
for nid in paths['K12']:
    key.setdefault(nid, (pos, 0, 0))
    pos += seglen[nid]
for rank, n in enumerate(['Sakai', 'CFT073', 'NCTC86', 'IAI39'], 1):
    anchor, off = -1, 0
    for nid in paths[n]:
        if nid in key and key[nid][2] == 0:
            anchor, off = key[nid][0], 0
            continue
        key.setdefault(nid, (anchor + 0.5, off, rank))
        off += seglen[nid]
order = sorted(seglen, key=lambda i: key.get(i, (1e12, 0, 0)))
```

Run `odgi groom -R k12.txt` first so the union FASTA reads on K12's strand; the
spike sorted the ungroomed graph.

**Open before a tutorial section:**

- Nothing has loaded in JBrowse yet. The plan: the union FASTA as an assembly,
  a presence row per strain from the flatten BED, and a PAF from the same BED
  to each strain so a synteny view draws each strain's genes against the axis.
- SNP bubbles chop the shared backbone: K12 and Sakai share only 10 runs over
  1 kb. A presence row needs runs merged across short gaps, or it draws stripes.
- The order is anchored on K12, so the axis is K12 with every other strain's
  sequence opened between its bases. A graph rebuild moves every coordinate,
  so a paper cannot cite a position on it.
- Human-scale graphs were not tried. There, opening insertions per window on
  the reference axis likely beats a global union.

Fits as one section of `pangenome_ecoli.md`, after per-strain presence, or as a
footnote there if the JBrowse picture adds nothing to the plot above.
