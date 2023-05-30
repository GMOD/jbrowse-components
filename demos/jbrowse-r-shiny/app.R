# Load packages ---
library(shiny)
library(JBrowseR)

# User interface ---
ui <- fluidPage(
  titlePanel("JBrowseR Demo (with Shiny)"),
  tags$head(
    tags$style(
      "#text {
          border: '1px black',
          height: '50px'
        }"
    )
  ),
  sidebarLayout(
    sidebarPanel(
      h4("Control the view"),
      span("This is an example of controlling the view from other elements
        on the page. Clicking on a button below will navigate to the location of
        that gene:"),
      br(),
      actionButton("cyp", "CYP2C19"),
      actionButton("brc", "BRCA2"),
      h4("See the state"),
      span("The button below will show you the current 'session', which
        includes things like what region the view is showing and which
        tracks are open. This 'session' object can be used in the"),
      code("JBrowseR"),
      span("slot of"),
      code("renderJBrowseR"),
      br(),
      actionButton("session", "Show session"),
      verbatimTextOutput("text"),
      h4("React to the view"),
      span("Manipulate the view using the checkboxes below to show or hide
        the tracks available:"),
      checkboxInput("checkref", "Reference sequence (hg38)", value = TRUE),
      checkboxGroupInput(
        "checks",
        NULL,
        c(
          "(Annotations) GCA_000001405" = "an", "(Alignments) NA12878" = "al",
          "(BigWig) hg38" = "bw", "(Variants) ALL" = "va"
        ),
        c("an", "bw", "va"),
      ),
      h4("Docs"),
      span("Full documentation for JBrowse R is available at "),
      a(
        href = "https://gmod.github.io/JBrowseR/",
        "https://gmod.github.io/JBrowseR/"
      ),
      h4("Code"),
      span("The code for this app is available at"),
      a(
        href = "https://github.com/GMOD/jbrowse-components/tree/main/demos/jbrowse-r-shiny", # nolint
        "https://github.com/GMOD/jbrowse-components/tree/main/demos/jbrowse-r-shiny" # nolint
      ),
      h4("Citation"),
      span("JBrowse R was developed by "),
      a(href = "https://orcid.org/0000-0003-2068-3366", "Elliot Hershberg"),
      span(" and the "),
      a(href = "https://github.com/gmod/jbrowse-components", "JBrowse 2 Team"),
      br(),
      span("Please cite where appropriate:"),
      br(),
      a(
        href = "https://doi.org/10.1093/bioinformatics/btab459",
        "Hershberg et al., 2021.
        JBrowseR: An R Interface to the JBrowse 2 Genome Browser"
      )
    ),
    mainPanel(
      JBrowseROutput("browserOutput"),
    )
  )
)

# Server logic ---
server <- function(input, output, session) {
  # create the necessary JB2 assembly configuration
  assembly <- assembly(
    "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
    bgzip = TRUE,
    aliases = ("hg38"),
    refname_aliases =
      "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  )

  # JB2 track configuration
  annotations <- track_feature(
    "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz", # nolint
    assembly
  )

  alignments <- track_alignments(
    "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram", # nolint
    assembly
  )

  wiggles <- track_wiggle(
    "https://hgdownload.cse.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw", # nolint
    assembly
  )

  variants <- track_variant(
    "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz", # nolint
    assembly
  )

  tracks <- tracks(
    annotations,
    variants,
    alignments,
    wiggles
  )

  text_index <- text_index(
    "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix", # nolint
    "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx", # nolint
    "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz_meta.json", # nolint
    "hg38"
  )

  # set up the default session for the browser
  default_session <- default_session(
    assembly,
    c(alignments, wiggles, variants),
  )

  loc <- reactiveValues(val = "10:29,838,565..29,838,860")
  shown_tracks <- reactiveValues(val = c(alignments, wiggles, variants))

  # link the UI with the browser widget
  output$browserOutput <- renderJBrowseR(
    JBrowseR(
      "View",
      assembly = assembly,
      tracks = tracks,
      location = loc$val,
      text_index = text_index,
      defaultSession = default_session
    )
  )

  # interactive events in the shiny app
  observeEvent(input$cyp, {
    loc$val <- "10:94762681..94855547"
  })

  observeEvent(input$brc, {
    loc$val <- "13:32315086..32400266"
  })

  # could use prettify from jsonlite here, but it makes the out vertically large
  observeEvent(input$session, {
    output$text <- renderText({
      paste(
        "JBrowseR(
        \"View\",
        assembly =
          assembly(\n",
        assembly,
        "\n\t  ),\n\ttracks =
          tracks(\n",
        tracks,
        "\n\t  ),\n",
        "\tlocation = ",
        loc$val,
        "\n)"
      )
    })
  })

  observeEvent(input$checkref, {
    output$browserOutput <- renderJBrowseR(
      JBrowseR(
        "View",
        assembly = assembly,
        tracks = tracks,
        location = loc$val,
        text_index = text_index,
        defaultSession = default_session(
          assembly,
          shown_tracks$val,
          input$checkref
        )
      )
    )
  })

  observe({
    if (!is.null(input$checks)) {
      temp <- c()
      for (val in input$checks) {
        if (val == "an") {
          temp <- append(temp, annotations)
        }
        if (val == "al") {
          temp <- append(temp, alignments)
        }
        if (val == "va") {
          temp <- append(temp, variants)
        }
        if (val == "bw") {
          temp <- append(temp, wiggles)
        }
      }
      shown_tracks$val <- temp
    }
    # possibly have an else here for empty input?
  })
}

# Run ---
shinyApp(ui, server)
