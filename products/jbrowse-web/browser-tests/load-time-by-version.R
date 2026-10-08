#!/usr/bin/env Rscript
# Plot load-time-by-version.csv, which load-time-by-version.ts writes. The one
# argument is the PNG to write, default load-time-by-version.png beside this:
#   Rscript browser-tests/load-time-by-version.R \
#     ../../website/static/img/blog/v5.0.0/load_time_by_version.png
suppressPackageStartupMessages(library(ggplot2))

here <- dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)))
argv <- commandArgs(trailingOnly = TRUE)
png <- if (length(argv) >= 1) argv[1] else file.path(here, "load-time-by-version.png")

d <- read.csv(file.path(here, "load-time-by-version.csv"))
d$s <- d$load_ms / 1000
d$released <- grepl("^v\\d", d$version)

semver <- function(v) {
  core <- sub("^v", "", sub("-.*", "", v))
  parts <- do.call(rbind, lapply(strsplit(core, ".", fixed = TRUE), as.integer))
  beta <- grepl("-beta\\.", v)
  pre <- rep(9999L, length(v))
  pre[beta] <- as.integer(sub(".*-beta\\.", "", v[beta]))
  sprintf("%03d%03d%03d%04d", parts[, 1], parts[, 2], parts[, 3], pre)
}
versions <- unique(d[, c("version", "date", "released")])
versions$key <- paste0("zzz", versions$date)
versions$key[versions$released] <- semver(versions$version[versions$released])
versions <- versions[order(versions$key), ]
month <- format(as.Date(versions$date), "%b %Y")
versions$label <- ifelse(
  versions$released,
  sprintf("%s  (%s)", versions$version, month),
  sprintf("%s  (%s)", versions$version, trimws(format(as.Date(versions$date), "%e %b %Y")))
)
d$label <- factor(
  versions$label[match(d$version, versions$version)],
  levels = rev(versions$label)
)
d$condition <- factor(
  ifelse(d$latency_ms == 0, "Local server", sprintf("%d ms round trip", d$latency_ms)),
  levels = c("Local server", sprintf("%d ms round trip", sort(unique(d$latency_ms[d$latency_ms > 0]))))
)

stable <- versions$version[versions$released & !grepl("-", versions$version)]
baseline <- tail(stable, 1)
med <- aggregate(s ~ version + label + condition + released, d, median)
base <- med[med$version == baseline, ]
med$text <- sprintf("%.2f s", med$s)
new <- !med$released
med$text[new] <- sprintf(
  "%.2f s  —  %.1f× faster than %s",
  med$s[new], base$s[match(med$condition[new], base$condition)] / med$s[new], baseline
)

SURFACE <- "#fcfcfb"
INK <- "#0b0b0b"
INK2 <- "#52514e"
MUTED <- "#898781"
GRID <- "#e1e0d9"
C_BLUE <- "#2a78d6"
C_ORANGE <- "#eb6834"

p <- ggplot(med, aes(y = label)) +
  geom_segment(
    aes(x = 0, xend = s, yend = label, color = released),
    linewidth = 0.9, lineend = "round"
  ) +
  geom_point(
    data = d, aes(x = s, y = as.numeric(label) - 0.24),
    color = MUTED, alpha = 0.6, size = 1.1
  ) +
  geom_point(aes(x = s, color = released), size = 2.6) +
  geom_text(
    aes(x = s, label = text),
    hjust = 0, nudge_x = 0.15, size = 3, color = INK2
  ) +
  scale_color_manual(values = c(`TRUE` = C_BLUE, `FALSE` = C_ORANGE), guide = "none") +
  scale_x_continuous(
    limits = c(0, ceiling(max(d$s)) + 1.3), breaks = seq(0, ceiling(max(d$s))),
    expand = expansion(mult = c(0, 0.01)), labels = function(x) paste0(x, " s")
  ) +
  facet_wrap(~condition, nrow = 1) +
  labs(
    title = "JBrowse Web: cold load to a drawn BAM track, by release",
    subtitle = paste0(
      "volvox-sorted.bam at ctgA:1–20,000, a fresh browser each load. ",
      "The stem ends at the median; the dots under it are the runs."
    ),
    caption = paste0(
      "Headless Chrome on a 24-core Linux machine with no GPU, every build served over HTTP/2 by one server; ",
      "the round trip is emulated by Chrome.\n",
      "v5 builds draw with Canvas2D there; earlier releases draw in the RPC worker. ",
      "products/jbrowse-web/browser-tests/load-time-by-version.ts"
    ),
    x = NULL, y = NULL
  ) +
  theme_minimal(base_size = 11) +
  theme(
    plot.background = element_rect(fill = SURFACE, color = NA),
    panel.grid.major.y = element_blank(),
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_line(color = GRID, linewidth = 0.4),
    axis.text.y = element_text(color = INK, hjust = 0),
    axis.text.x = element_text(color = INK2),
    strip.text = element_text(color = INK, face = "bold", hjust = 0, size = 11),
    plot.title = element_text(color = INK, face = "bold", size = 14),
    plot.subtitle = element_text(color = INK2, size = 10, margin = margin(b = 10)),
    plot.caption = element_text(color = MUTED, size = 8, hjust = 0, lineheight = 1.15),
    plot.title.position = "plot",
    plot.caption.position = "plot",
    panel.spacing.x = unit(1.4, "lines"),
    plot.margin = margin(14, 18, 10, 14)
  )

ggsave(png, p, width = 9.6, height = 5.2, dpi = 200, bg = SURFACE)
