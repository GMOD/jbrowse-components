# ============================================================
# JBrowse 2 - Reproducible R Script
# Generated: 2026-01-28T06:03:33.775Z
# Region: ctgA:1-50001
# ============================================================

# Install packages if needed (uncomment to run)
# install.packages(c("ggplot2", "patchwork", "dplyr", "tibble"))
# BiocManager::install(c("rtracklayer", "VariantAnnotation", "Rsamtools"))
# devtools::install_github("GMOD/jbrowseR")
# devtools::install_github("GMOD/ggjbrowse")

# Load required packages
library(jbrowseR)
library(ggjbrowse)
library(ggplot2)
library(patchwork)
library(dplyr)

# Define region of interest
region <- jb_region("ctgA:1-50001")

# Create jbrowseR session
session <- jb_session(
  assembly = "volvox",
  tracks = list(
    gff3tabix_genes = jb_track_gff3("volvox.sort.gff3.gz"),
    volvox_microarray = jb_track_bigwig("volvox_microarray.bw")
  )
)

# ============================================================
# Load Data
# ============================================================

# --- GFF3Tabix genes ---
# Load feature data using jbrowseR
features_gff3tabix_genes <- jb_features(session, "gff3tabix_genes", region)

# --- wiggle_track xyplot ---
# Load coverage data using jbrowseR
coverage_volvox_microarray <- jb_features(session, "volvox_microarray", region)

# ============================================================
# Create Visualizations
# ============================================================

# Gene track: GFF3Tabix genes
#
# Step 1: Compute non-overlapping layout
# This assigns each feature to a row so overlapping features stack vertically
features_gff3tabix_genes_layout <- compute_layout(
  features_gff3tabix_genes |> dplyr::filter(type %in% c("gene", "mRNA", "transcript") | is.na(type)),
  start_col = "start",
  end_col = "end",
  padding = 500  # minimum gap between features in same row (bp)
)

# Step 2: Prepare subfeatures (exons, CDS, UTRs) for rendering
features_gff3tabix_genes_subs <- features_gff3tabix_genes |>
  dplyr::filter(type %in% c("exon", "CDS", "five_prime_UTR", "three_prime_UTR", "UTR"))

# Link subfeatures to parent layout rows
if (nrow(features_gff3tabix_genes_subs) > 0 && nrow(features_gff3tabix_genes_layout) > 0) {
  parent_rows <- setNames(features_gff3tabix_genes_layout$layout_row, features_gff3tabix_genes_layout$feature_id)
  features_gff3tabix_genes_subs <- features_gff3tabix_genes_subs |>
    dplyr::mutate(
      layout_row = sapply(parent_id, function(pid) {
        if (is.na(pid)) return(NA_real_)
        if (pid %in% names(parent_rows)) return(parent_rows[[pid]])
        NA_real_
      })
    ) |>
    dplyr::filter(!is.na(layout_row))
}

# Step 3: Create the plot
p_gff3tabix_genes <- ggplot() +
  # Draw intron lines (backbone)
  geom_segment(
    data = features_gff3tabix_genes_layout,
    aes(x = start, xend = end, y = layout_row, yend = layout_row),
    color = "gray50", linewidth = 0.5
  ) +
  # Draw exons/CDS as boxes
  geom_rect(
    data = features_gff3tabix_genes_subs |> dplyr::filter(type %in% c("CDS", "exon")),
    aes(xmin = start, xmax = end,
        ymin = layout_row - 0.35, ymax = layout_row + 0.35),
    fill = "#c9a857", color = "#8b7355", linewidth = 0.3
  ) +
  # Draw UTRs as thinner boxes
  geom_rect(
    data = features_gff3tabix_genes_subs |> dplyr::filter(grepl("UTR", type, ignore.case = TRUE)),
    aes(xmin = start, xmax = end,
        ymin = layout_row - 0.2, ymax = layout_row + 0.2),
    fill = "#c9a857", color = "#8b7355", linewidth = 0.3, alpha = 0.6
  ) +
  # Add labels
  geom_text(
    data = features_gff3tabix_genes_layout |> dplyr::filter(!is.na(name)),
    aes(x = start, y = layout_row + 0.5, label = name),
    hjust = 0, size = 2.5
  ) +
  scale_x_genomic(region = region) +
  labs(title = "GFF3Tabix genes", y = "Features") +
  theme_jbrowse_track() +
  theme(
    axis.text.y = element_blank(),
    axis.ticks.y = element_blank()
  )

# Coverage track: wiggle_track xyplot
p_volvox_microarray <- ggplot(coverage_volvox_microarray, aes(x = start, xend = end, y = score)) +
  geom_wiggle(fill = "steelblue", alpha = 0.8) +
  scale_x_genomic(region = region) +
  labs(title = "wiggle_track xyplot", y = "Score") +
  theme_jbrowse_track() +
  theme(plot.margin = margin(5, 5, 5, 5))

# ============================================================
# Combine Tracks
# ============================================================

combined_plot <- p_gff3tabix_genes / p_volvox_microarray +
  plot_layout(heights = c(1, 1)) +
  plot_annotation(
    title = "JBrowse View: ctgA:1-50001",
    theme = theme(plot.title = element_text(hjust = 0.5))
  )

# Display the plot
print(combined_plot)

# Save to file
ggsave("jbrowse_export.pdf", combined_plot, width = 12, height = 4)
ggsave("jbrowse_export.png", combined_plot, width = 12, height = 4, dpi = 300)

# ============================================================
# Alternative: Launch Interactive JBrowse View
# ============================================================

# Uncomment to open interactive JBrowse session in browser:
# jb_view(session, region)