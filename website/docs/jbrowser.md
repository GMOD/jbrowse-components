---
title: JBrowseR
sidebar_label: Embedding in R / Shiny
description:
  Embed a GPU-accelerated JBrowse 2 linear genome view (or a synteny/dotplot
  comparison) in R Markdown, Shiny, or the R console with the JBrowseR
  htmlwidget
---

[JBrowseR](https://github.com/GMOD/JBrowseR) renders a JBrowse 2 linear genome
view, drawn on the GPU, as an [htmlwidget](https://www.htmlwidgets.org/). Embed
a full genome browser in an R Markdown document or Shiny app, or launch one from
the R console. It shares the same framework-agnostic view core as the
[Python anywidget](/docs/jbrowse_anywidget), so both stay in step.

## Install

```r
# install.packages("devtools")
devtools::install_github("GMOD/JBrowseR")
```

## A declarative API

Every argument is a JBrowse [embedding option](/docs/embedded_components), named
as JBrowse names it and passed through unchanged. Assemblies, tracks and views
are JBrowse's own [config objects](/docs/config_guide) written as R lists, so
any track type, view type or option works with nothing added to the package, and
a whole config is `do.call(JBrowseRApp, config)`.

Name a hosted genome and the assembly, reference-name aliases, cytobands, and
gene-name search all come preconfigured, and `location` can be a gene symbol:

```r
library(JBrowseR)

JBrowseR(assembly = "hg38", location = "BRCA1")
```

Add tracks by URL. The track type and index files (`.bai`/`.crai`/`.tbi`) are
inferred from the extension:

```r
JBrowseR(
  assembly = "hg38",
  tracks = list(
    list(
      uri = "https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram",
      name = "NA12878 Exome"
    )
  ),
  location = "17:43,044,295..43,048,000"
)
```

`track_data_frame()` turns an in-memory data frame into a track with no file or
server, which is the one thing a config file can't express. A genome of your own
is `list(name = "mygenome", uri = "https://.../mygenome.fa.gz")`.

## Comparing genomes

`JBrowseR()` shows a single linear genome view. `JBrowseRApp()` drives the full
app from a `views` list, each entry a view as a config's `defaultSession.views`
writes it, so a linear synteny view or a dotplot is one call:

```r
base <- "https://jbrowse.org/demos/ecoli_pangenome"
strains <- c("K12", "Sakai", "CFT073", "NCTC86")

JBrowseRApp(
  assemblies = list(
    list(name = "K12", uri = paste0(base, "/K12.fa.gz")),
    list(name = "Sakai", uri = paste0(base, "/Sakai.fa.gz"))
  ),
  tracks = list(
    list(
      type = "SyntenyTrack",
      trackId = "ecoli_ava",
      name = "E. coli all-vs-all",
      assemblyNames = as.list(strains),
      adapter = list(
        type = "MultiGenomePAFAdapter",
        assemblyNames = as.list(strains),
        pafLocation = list(uri = paste0(base, "/all_vs_all.paf.gz"))
      )
    )
  ),
  views = list(
    list(
      type = "DotplotView",
      views = list(list(assembly = "K12"), list(assembly = "Sakai")),
      tracks = list("ecoli_ava")
    )
  )
)
```

The
[comparative-synteny vignette](https://gmod.github.io/JBrowseR/articles/comparative-synteny.html)
stacks four strains from the same alignment in a linear synteny view, the hosted
data of the [all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny).

## Reacting to clicks in Shiny

Rendered inside Shiny, clicking a feature sets
`input$<outputId>_selected_feature` to the feature's data, so tables, plots, and
links can follow the current selection. Pair `JBrowseROutput()` with
`renderJBrowseR()`, or `JBrowseRAppOutput()` with `renderJBrowseRApp()`, and
`update_jbrowse()` changes options on a browser already on the page.

## Run in Colab

A runnable
[R-runtime Colab notebook](https://colab.research.google.com/github/GMOD/JBrowseR/blob/main/examples/JBrowseR_colab.ipynb)
walks through the one-line genome, alignments, an R data-frame track, and cancer
structural variants.

Full documentation is at
[gmod.github.io/JBrowseR](https://gmod.github.io/JBrowseR/).

## See also

- [](/docs/jbrowse_anywidget): Python equivalent
- [](/docs/embedded_components): the JS/React view this wraps
