---
title: JBrowse in a Jupyter notebook
sidebar_label: Jupyter notebooks
description:
  Run a JBrowse 2 genome view in Jupyter, Colab, VS Code, or marimo as an
  anywidget, with two-way sync between Python and the view
---

[`jbrowse-anywidget`](https://github.com/GMOD/jbrowse-anywidget) renders a
JBrowse 2 linear genome view as an [anywidget](https://anywidget.dev), drawn on
the GPU. One bundle runs in Jupyter, JupyterLab, VS Code, marimo, and Google
Colab, with two-way sync of the visible region between Python and the view: set
`view.location` to navigate, read it back to get where the user panned.

`LinearGenomeView` covers the common case. For comparative genomics,
`JBrowseApp` drives the full app from a declarative `views` list, so a notebook
can also hold a linear synteny view or a dotplot (`synteny_view`, `dotplot_view`
build the specs). See the E. coli example below.

It is the modern replacement for the older Dash-based `jbrowse-jupyter` +
`dash_jbrowse` stack: no Dash server, no component-generation step, just a
prebuilt ESM bundle loaded by anywidget.

Install from GitHub for now (below). A PyPI release is planned, after which
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
to the view, so every track type and adapter works with no Python wrapper to
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
[genomes.jbrowse.org](https://genomes.jbrowse.org) (sequence, refName aliases,
cytobands, a gene-name search index, and a catalog of hosted tracks) as plain
JSON you pass in. Because the assembly carries refName aliases, your own tracks
line up even when they name chromosomes differently (`chr17` vs `17`).

## Example notebooks

Each opens in Colab and runs top-to-bottom.

| Notebook                                                                                                                                              | What it shows                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Quickstart](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/01_quickstart.ipynb)                                  | An assembly, a track by URL, two-way location sync                                                |
| [bioframe → track](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/02_dataframe_analysis.ipynb)                    | A bioframe result (real UCSC CpG islands → their shores) becomes a track                          |
| [GPU alignments](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/03_alignments.ipynb)                              | A BAM/CRAM pileup, colored by pair orientation                                                    |
| [Multi-sample variants](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/04_multisample_variants.ipynb)             | A multi-sample VCF as a per-sample band and a genotype matrix                                     |
| [Read depth from a BAM](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/05_bam_coverage.ipynb)                     | Real 1000G NA12878 exome coverage over _BRCA1_, computed with pysam                               |
| [Selection scan → view](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/06_popgen_selection.ipynb)                 | Windowed Fst between two _Drosophila_ populations; the sweep lands over _Cyp6g1_ (real DEST data) |
| [Differential expression → view](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/07_differential_expression.ipynb) | Counts → log2FC, Welch t-test (scipy) + BH-FDR (statsmodels) → a colored gene track               |
| [Hosted assembly hub](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/08_hosted_assembly_hub.ipynb)                | `fetch_hub` for easy human data; navigate by gene name                                            |
| [Interactive controls](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/09_interactive_controls.ipynb)              | An `ipywidgets` slider re-runs the analysis and repaints the track                                |
| [Region-reactive](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/10_region_reactive.ipynb)                        | Recompute pysam coverage only over the window in view, adapting to zoom                           |
| [Compare genomes (synteny)](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/11_synteny_ecoli.ipynb)                | Four _E. coli_ strains in a linear synteny view from one all-vs-all PAF                           |

Notebooks 05–07 are the core loop: **run an analysis in Python, load the result
onto the genome**, using the tools scientists already reach for (pysam,
bioframe, scipy/statsmodels) on real data. Notebooks 09–10 close the loop the
other way: a widget control or a pan in the view drives Python to **recompute
and repaint** live.

## See also

- [Embedded components](/docs/embedded_components) - the underlying JS/React
  linear genome view this wraps
- [JBrowseR](/docs/jbrowser) - the R/Shiny equivalent
