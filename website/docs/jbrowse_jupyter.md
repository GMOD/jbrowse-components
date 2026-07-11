---
title: JBrowse in a Jupyter notebook
sidebar_label: Jupyter notebooks
description:
  Run a JBrowse 2 linear genome view in Jupyter, Colab, or VS Code as an
  anywidget, with two-way sync between Python and the view
---

[`jbrowse-anywidget`](https://github.com/GMOD/jbrowse-anywidget) renders a
JBrowse 2 linear genome view as an [anywidget](https://anywidget.dev), drawn on
the GPU. One bundle runs in Jupyter, JupyterLab, VS Code, and Google Colab, with
two-way sync of the visible region between Python and the view — set
`view.location` to navigate, read it back to get where the user panned.

It is the modern replacement for the older Dash-based `jbrowse-jupyter` +
`dash_jbrowse` stack: no Dash server, no component-generation step, just a
prebuilt ESM bundle loaded by anywidget.

Install from GitHub for now (below) — a PyPI release is planned, after which
`pip install jbrowse-anywidget` will work directly. The example notebooks each
open in Colab with one click.

## Install

```bash
pip install "jbrowse-anywidget @ git+https://github.com/GMOD/jbrowse-anywidget"
```

In Google Colab, also enable third-party widgets once per notebook:

```python
from google.colab import output
output.enable_custom_widget_manager()
```

## The interface is JBrowse's own config

Assemblies, tracks, and sessions are the same
[JSON-like config](/docs/config_guide) JBrowse uses everywhere, handed straight
to the view — so every track type and adapter works with no Python wrapper to
keep in sync.

```python
from jbrowse_anywidget import LinearGenomeView, make_assembly

view = LinearGenomeView(
    assembly=make_assembly("hg38", ".../hg38.fa.gz"),
    location="10:29,838,565..29,838,850",
)
view.add_track({
    "type": "AlignmentsTrack",
    "trackId": "reads",
    "name": "reads",
    "assemblyNames": ["hg38"],
    "adapter": {"type": "CramAdapter", "uri": ".../reads.cram"},  # GPU pileup
})
view            # display the widget
view.location   # read back the current region after panning
```

Python adds only what JSON can't express itself: `add_features` (turn an
in-memory pandas DataFrame into a track, no file written) and `make_assembly` (a
little assembly boilerplate).

For human and model-organism data, `fetch_hub("hg38")` (also `hg19`, `mm10`, or
a GenArk `GCA_...`) returns a ready, CORS-enabled assembly config from
[genomes.jbrowse.org](https://genomes.jbrowse.org) — sequence, refName aliases,
cytobands, a gene-name search index, and a catalog of hosted tracks — as plain
JSON you pass in. Because the assembly carries refName aliases, your own tracks
line up even when they name chromosomes differently (`chr17` vs `17`).

## Example notebooks

Each opens in Colab and runs top-to-bottom.

| Notebook                                                                                                                                              | What it shows                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [Quickstart](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/01_quickstart.ipynb)                                  | An assembly, a track by URL, two-way location sync              |
| [DataFrame → track](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/02_dataframe_analysis.ipynb)                   | A pandas DataFrame becomes a track; color by a computed value   |
| [GPU alignments](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/03_alignments.ipynb)                              | A BAM/CRAM pileup, colored by pair orientation                  |
| [Multi-sample variants](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/04_multisample_variants.ipynb)             | A multi-sample VCF as a per-sample band and a genotype matrix   |
| [Call CNVs → view](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/05_cnv_calling.ipynb)                           | Segment binned depth into gain/loss calls (ERBB2 amplification) |
| [Selection scan → view](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/06_popgen_selection.ipynb)                 | Windowed Fst; the sweep lands over _LCT_                        |
| [Differential expression → view](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/07_differential_expression.ipynb) | Counts → log2FC / t-test → a gene track colored by call         |
| [Hosted assembly hub](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/08_hosted_assembly_hub.ipynb)                | `fetch_hub` for easy human data; navigate by gene name          |

The "→ view" notebooks are the core loop — **run an analysis in Python, load the
result onto the genome** — with everything computed in the notebook.

## See also

- [Embedded components](/docs/embedded_components) — the underlying JS/React
  linear genome view this wraps
- [JBrowseR](/docs/jbrowser) — the R/Shiny equivalent
