---
name: tutorial-demand
description: What people ask about on GitHub, tallied by topic from issue and discussion titles (2026-07-26), and what it says about which tutorials to write. Read before ranking a tutorial idea by demand.
audience: internal
kind: measurement
---

# Tutorial demand, from GitHub

What people ask, as against what the code supports: 382 discussions in Q&A,
General and Ideas back to 2020, plus the 600 most recent issues back to
2023-06, pulled 2026-07-26. A keyword tally over titles only, so read it as
direction rather than a measurement. Counts are discussions plus issues.

| Topic | Count | Note |
| --- | --- | --- |
| GFF/GTF loading and gene models | 18 + 19 | steady through 2024-2026 |
| Embedding (React, Vue, UMD, iframe) | 26 + 17 | peaked 2023, falling since |
| Assembly setup (FASTA, refNames, aliases) | 19 + 23 | steady |
| Track catalogs, hubs, connections, faceted selector | 10 + 25 | peaked 2023 |
| Text search and `text-index` / trix | 11 + 13 | rising, 2024 heaviest |
| Hi-C | 7 + 7 | steady, low volume |
| Figures and export | 4 + 17 | steady |
| Hosting, CORS, range requests, deploy | 5 + 7 | FAQ entries answer most |
| Auth and private data | 3 + 7 | |
| Notebooks (Jupyter, R, anywidget) | 1 + 4 | |
| Variant interpretation | 0 + 0 | |
| Sequence tools (BLAT, PCR, CRISPR) | 1 + 0 | |
| GWAS and LD | 1 + 0 | |
| Conservation and MAF | 0 + 1 | |
| Tandem repeats and STRs | 0 + 0 | |

- **Annotation loading and gene search is the largest cluster**, and recent; no
  tutorial ends with `jbrowse text-index` making a gene set searchable.
- **Embedding demand is large but mostly answered**; the gap is currency
  (framework versions, React 19), not a new page.
- **A low count on hosting and CORS is not low value**: FAQ entries rank in
  search, and someone who finds the answer never files.
- **A zero on a new feature is no baseline, not no demand.**

Re-run: `gh issue list --repo GMOD/jbrowse-components --state all --limit 600
--json title,createdAt,labels` plus a `gh api graphql` discussions query.
