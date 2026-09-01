#!/usr/bin/env Rscript
# Plot the JS-bytes-over-the-wire trend (boot LGV + open a track) across
# JBrowse versions, from <basename>.json. Run after the harness:
#   node browser-tests/bundle-size-by-version.ts
#   Rscript browser-tests/bundle-size-by-version.R
#
# A non-default harness track (--track volvox_bam, say) writes its own
# bundle-size-by-version-volvox_bam.json; pass that basename as this script's
# one argument to plot it instead of the committed gff3tabix_genes baseline:
#   Rscript browser-tests/bundle-size-by-version.R bundle-size-by-version-volvox_bam
suppressPackageStartupMessages({
  library(ggplot2)
  library(jsonlite)
})

here <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)))
if (length(here) == 0) here <- "."

argv <- commandArgs(trailingOnly = TRUE)
basename <- if (length(argv) >= 1) argv[1] else "bundle-size-by-version"

d <- fromJSON(file.path(here, paste0(basename, ".json")))
d$jsMB <- d$jsBytes / 1024 / 1024

# Released versions (vX.Y.Z) sort by semver; any non-semver label (the local
# build) is pinned to the right edge. Major release drives the colour band.
semver <- grepl("^v\\d+\\.\\d+\\.\\d+$", d$version)
key <- ifelse(semver,
  sprintf("%03d%03d%03d",
    as.integer(sub("v(\\d+)\\..*", "\\1", d$version)),
    as.integer(sub("v\\d+\\.(\\d+)\\..*", "\\1", d$version)),
    as.integer(sub("v\\d+\\.\\d+\\.(\\d+)", "\\1", d$version))),
  "zzz")
d <- d[order(key), ]
d$version <- factor(d$version, levels = d$version)
d$major <- ifelse(grepl("^v\\d", as.character(d$version)),
  sub("v(\\d+)\\..*", "v\\1.x", as.character(d$version)),
  "local build")
d$major <- factor(d$major, levels = c(sort(unique(grep("^v", d$major, value = TRUE))), "local build"))
d$isLocal <- d$major == "local build"

track <- sub("^bundle-size-by-version-?", "", basename)
if (track == "") track <- "gff3tabix_genes"

p <- ggplot(d, aes(version, jsMB, group = 1)) +
  geom_line(color = "grey60", linewidth = 0.6) +
  geom_point(aes(color = major, size = isLocal, shape = isLocal)) +
  scale_size_manual(values = c(`FALSE` = 2.6, `TRUE` = 5), guide = "none") +
  scale_shape_manual(values = c(`FALSE` = 16, `TRUE` = 18), guide = "none") +
  geom_smooth(data = subset(d, !isLocal), aes(group = 1),
              method = "loess", formula = y ~ x,
              se = FALSE, color = "black", linetype = "dashed", linewidth = 0.5) +
  scale_y_continuous(limits = c(0, NA),
                     breaks = scales::pretty_breaks(6),
                     labels = function(x) sprintf("%.1f MB", x)) +
  labs(
    title = "JBrowse initial-load JS over the wire by version",
    subtitle = sprintf("Boot a Linear Genome View + open the %s track (volvox assembly, gzip, over the wire)", track),
    x = NULL, y = "Total JS bytes over the wire", color = "Release"
  ) +
  theme_minimal(base_size = 13) +
  theme(
    axis.text.x = element_text(angle = 60, hjust = 1, size = 9),
    panel.grid.minor = element_blank(),
    plot.title = element_text(face = "bold")
  )

out <- file.path(here, paste0(sub("^bundle-size-by-version", "bundle-size-trend", basename), ".png"))
ggsave(out, p, width = 11, height = 5.5, dpi = 130)
cat("wrote", out, "\n")
