---
title: JBrowseR
sidebar_label: R / Shiny
description:
  Embed a GPU-accelerated JBrowse 2 linear genome view in R Markdown, Shiny, or
  the R console with the JBrowseR htmlwidget
---

[JBrowseR](https://github.com/GMOD/JBrowseR) renders a JBrowse 2 linear genome
view, drawn on the GPU, as an [htmlwidget](https://www.htmlwidgets.org/). Embed
a full genome browser in an R Markdown document or Shiny app, or launch one from
the R console. It shares the same framework-agnostic view core as the
[Python/Jupyter anywidget](/docs/jbrowse_jupyter), so both stay in step.

## Install

```r
# released
install.packages("JBrowseR")

# development
# install.packages("remotes")
remotes::install_github("GMOD/JBrowseR")
```

## A declarative API

You describe the browser with plain values; helper constructors build the
config. There are no JSON strings to assemble and nothing imperative to wire up.

Name a hosted genome and the assembly, reference-name aliases, cytobands, and
gene-name search all come preconfigured — `location` can be a gene symbol:

```r
library(JBrowseR)

JBrowseR("hg38", location = "BRCA1")
```

Add tracks by URL. The track type and index files (`.bai`/`.crai`/`.tbi`) are
inferred from the extension:

```r
JBrowseR(
  "hg38",
  tracks = tracks(
    track(
      "https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram",
      name = "NA12878 Exome"
    )
  ),
  location = "17:43,044,295..43,048,000"
)
```

R adds what a config can't express itself: `track_data_frame()` turns an
in-memory data frame into a track (no file, no server), and `assembly()` writes
a little assembly boilerplate from a FASTA URL. For full control, hand a whole
JBrowse `config.json` to `JBrowseR(config = ...)`.

## Reacting to clicks in Shiny

Rendered inside Shiny, clicking a feature sets `input$selectedFeature` to the
feature's data, so tables, plots, and links can follow the current selection.
Use `JBrowseROutput()` in the UI and `renderJBrowseR()` on the server.

## Run it in Colab

A runnable
[R-runtime Colab notebook](https://colab.research.google.com/github/GMOD/JBrowseR/blob/main/examples/JBrowseR_colab.ipynb)
walks through the one-line genome, alignments, an R data-frame track, and cancer
structural variants.

Full documentation is at
[gmod.github.io/JBrowseR](https://gmod.github.io/JBrowseR/).

## See also

- [JBrowse Jupyter](/docs/jbrowse_jupyter) — the Python/Jupyter equivalent
- [Embedded components](/docs/embedded_components) — the underlying JS/React
  linear genome view this wraps
