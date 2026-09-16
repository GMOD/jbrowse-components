---
title: jbrowse-anywidget
sidebar_label: Embedding in Python
description:
  Run a JBrowse 2 genome view in Jupyter, Colab, VS Code, or marimo as a Python
  anywidget, with two-way sync between Python and the view
---

[`jbrowse-anywidget`](https://github.com/GMOD/jbrowse-anywidget) renders a
JBrowse 2 linear genome view as an [anywidget](https://anywidget.dev), drawn on
the GPU. One bundle runs in Jupyter, JupyterLab, VS Code, marimo, and Google
Colab, with two-way sync of the visible region between Python and the view: set
`view.location` to navigate, read it back to get where the user panned.

`LinearGenomeView` covers the common case. `JBrowseApp` drives the full app from
a `views` list, so a notebook can also hold a linear synteny view or a dotplot.
Each entry is a view as a config's `defaultSession.views` writes it. See the E.
coli example below.

`jbrowse-anywidget` replaces the older Dash-based `jbrowse-jupyter` +
`dash_jbrowse` stack with a prebuilt ESM bundle loaded by anywidget, so there is
no Dash server to run and no component-generation step.

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

## The config the widget takes

A widget's keyword arguments are the JBrowse
[embedding options](/docs/embedded_components) as JSON, passed through
unchanged: assemblies, tracks and sessions are the same
[config objects](/docs/config_guide) JBrowse uses everywhere, so every track
type, adapter and option works with no Python wrapper to keep in sync.

```python
from jbrowse_anywidget import LinearGenomeView, features_track

view = LinearGenomeView(
    assembly={"name": "mygenome", "uri": ".../mygenome.fa.gz"},
    location="chr1:1..20,000",
    tracks=[
        {
            "type": "AlignmentsTrack",
            "trackId": "reads",
            "name": "reads",
            "assemblyNames": ["mygenome"],
            "adapter": {"type": "CramAdapter", "uri": ".../reads.cram"},
        }
    ],
)
view            # display the widget
view.location   # read back the current region after panning

view.update(tracks=[*view.options["tracks"], features_track(df, name="peaks")])
```

`assembly` also takes a hosted genome by name (`"hg38"`, `"mm39"`, or a GenArk
`GCA_...`), which brings refName aliases, cytobands and gene-name search from
[genomes.jbrowse.org](https://genomes.jbrowse.org), so your own tracks line up
even when they name chromosomes differently (`chr17` vs `17`). `update` merges
keys into the options, and `features_track` turns an in-memory DataFrame into a
track with no file written.

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
| [Large results](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/12_large_data.ipynb)                               | Where `features_track` stops being the right door, and writing a file starts                      |
| [Large signal](https://colab.research.google.com/github/GMOD/jbrowse-anywidget/blob/main/examples/13_large_wiggle.ipynb)                              | Three routes for a quantitative track, the data type that gets big fastest                        |

Notebooks 05–07 are the core loop: **run an analysis in Python, load the result
onto the genome**, using the tools scientists already reach for (pysam,
bioframe, scipy/statsmodels) on real data. Notebooks 09–10 close the loop the
other way: a widget control or a pan in the view drives Python to **recompute
and repaint** live. Notebooks 12–13 are where a result outgrows that loop, since
`features_track` carries every row in the widget's own state.

## See also

- [](/docs/embedded_components): the JS/React view this wraps
- [](/docs/jbrowser): R/Shiny equivalent
