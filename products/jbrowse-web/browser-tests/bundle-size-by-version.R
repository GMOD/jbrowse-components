#!/usr/bin/env Rscript
# Plot the JS-bytes-over-the-wire trend (boot LGV + open a gene track) across
# JBrowse versions, from bundle-size-by-version.json. Run after the harness:
#   node browser-tests/bundle-size-by-version.ts
#   Rscript browser-tests/bundle-size-by-version.R
suppressPackageStartupMessages({
  library(ggplot2)
  library(jsonlite)
})

here <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)))
if (length(here) == 0) here <- "."

d <- fromJSON(file.path(here, "bundle-size-by-version.json"))
d$jsMB <- d$jsBytes / 1024 / 1024

# Chronological order on x; major release as a colour band.
ord <- order(
  as.integer(sub("v(\\d+)\\..*", "\\1", d$version)),
  as.integer(sub("v\\d+\\.(\\d+)\\..*", "\\1", d$version)),
  as.integer(sub("v\\d+\\.\\d+\\.(\\d+)", "\\1", d$version))
)
d <- d[ord, ]
d$version <- factor(d$version, levels = d$version)
d$major <- factor(sub("v(\\d+)\\..*", "v\\1.x", as.character(d$version)))

p <- ggplot(d, aes(version, jsMB, group = 1)) +
  geom_line(color = "grey60", linewidth = 0.6) +
  geom_point(aes(color = major), size = 2.6) +
  geom_smooth(aes(group = 1), method = "loess", formula = y ~ x,
              se = FALSE, color = "black", linetype = "dashed", linewidth = 0.5) +
  scale_y_continuous(limits = c(0, NA),
                     breaks = scales::pretty_breaks(6),
                     labels = function(x) sprintf("%.1f MB", x)) +
  labs(
    title = "JBrowse initial-load JS over the wire by version",
    subtitle = "Boot a Linear Genome View + open the volvox gff3tabix gene track (raw, uncompressed)",
    x = NULL, y = "Total JS bytes over the wire", color = "Release"
  ) +
  theme_minimal(base_size = 13) +
  theme(
    axis.text.x = element_text(angle = 60, hjust = 1, size = 9),
    panel.grid.minor = element_blank(),
    plot.title = element_text(face = "bold")
  )

out <- file.path(here, "bundle-size-trend.png")
ggsave(out, p, width = 11, height = 5.5, dpi = 130)
cat("wrote", out, "\n")
