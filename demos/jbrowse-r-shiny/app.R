# Load packages ---
library(shiny)
library(JBrowseR)
library(bslib)
library(tibble)
library(DT)
library(dplyr)

# Bootstrap ---
bs_theme <- bs_theme(version = 5)

# User interface ---
ui <- fluidPage(
  theme = bs_theme,
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
      h4("Using dataframes"),
      h5("Add a track"),
      span("You can use dataframes to render tracks in JBrowse R.
        Click the button below to add the track data represented in
        the table below to a new track in JBrowse R."),
      br(),
      actionButton(
        "add",
        label = "Add track",
        icon = icon("plus")
      ),
      tableOutput("tracks"),
      h5("Add or remove bookmarks"),
      span("You can use dataframes to add or remove bookmarks in JBrowse R.\n
        Click on a feature on a JBrowse track to add a bookmark.\n
        Select a row and click the delete button to remove a bookmark.\n
        Select a row and click the navigate button to navigate to a bookmark."),
      br(),
      actionButton(
        "delete",
        label = "Delete selected table rows",
        icon = icon("trash")
      ),
      actionButton(
        "navigate",
        label = "Navigate to selected bookmark",
        icon = icon("arrow-right")
      ),
      br(),
      dataTableOutput("bookmarks"),
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

  text_index <- text_index(
    "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ix", # nolint
    "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz.ixx", # nolint
    "https://jbrowse.org/genomes/GRCh38/ncbi_refseq/trix/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz_meta.json", # nolint
    "hg38"
  )

  tracks <- tracks(
    annotations,
    variants,
    alignments,
    wiggles
  )

  # set up the default session for the browser
  default_session <- default_session(
    assembly,
    c(alignments, wiggles, variants),
  )

  # some reactive values that our UI can change
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

  # buttons to nav to specific locations
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

  # add or remove bookmark logic
  values <- reactiveValues()

  values$bookmark_df <- tibble::tibble(
    chrom = character(),
    start = numeric(),
    end = numeric(),
    name = character()
  )

  observeEvent(input$selectedFeature, {
    values$bookmark_df <- values$bookmark_df %>%
      add_row(
        chrom = input$selectedFeature$refName,
        start = input$selectedFeature$start,
        end = input$selectedFeature$end,
        name = input$selectedFeautre$name
      )
  })

  observeEvent(input$delete, {
    if (!is.null(input$bookmarks_rows_selected)) {
      values$bookmark_df <- values$bookmark_df %>%
        slice(-input$bookmarks_rows_selected)
    }
  })

  output$bookmarks <- DT::renderDT(values$bookmark_df)

  # navigate to bookmark logic
  observeEvent(input$navigate, {
    if (!is.null(input$bookmarks_rows_selected)) {
      loc$val <- paste0(
        values$bookmark_df[input$bookmarks_rows_selected, "chrom"],
        ":",
        values$bookmark_df[input$bookmarks_rows_selected, "start"],
        "..",
        values$bookmark_df[input$bookmarks_rows_selected, "end"]
      )
    }
  })

  # logic for adding sample track df to JBrowse R
  values$tracks_df <- data.frame(
    chrom = c("10", "10", "13"),
    start = c(94780000, 29838600, 32330000),
    end = c(94810000, 29838760, 32370000),
    name = c("feature1", "feature2", "feature3")
  )

  output$tracks <- renderTable(values$tracks_df)

  observeEvent(input$add, {
    df_track <- track_data_frame(values$tracks_df, "new_track", assembly)
    shown_tracks$val <- append(shown_tracks$val, df_track)

    output$browserOutput <- renderJBrowseR(
      JBrowseR(
        "View",
        assembly = assembly,
        tracks = tracks(wiggles, annotations, alignments, variants, df_track),
        location = loc$val,
        text_index = text_index,
        defaultSession = default_session(
          assembly,
          shown_tracks$val,
        )
      )
    )
  })
}

# Run ---
shinyApp(ui, server)
