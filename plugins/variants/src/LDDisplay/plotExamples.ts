import type { PlotExample } from '@jbrowse/core/configuration'

export const LD_PLOT_EXAMPLES: PlotExample[] = [
  {
    plot: '{ "encoding": { "color": "dprime" } }',
    description: "cells show D' on blues instead of R² on reds",
  },
  {
    plot: '{ "encoding": { "color": { "field": "r2", "scale": { "scheme": "viridis" } } } }',
    description: 'R² on the viridis scheme',
  },
  {
    plot: '{ "encoding": { "color": { "field": "r2", "scale": { "domainMin": 0.2 } } } }',
    description: 'R² below 0.2 draws as the low end of the ramp',
  },
  {
    plot: '{ "encoding": { "color": { "field": "r2", "scale": { "type": "threshold", "domain": ["0.2", "0.4", "0.6", "0.8"], "range": ["#357ebd", "#46b8da", "#5cb85c", "#eea236", "#d43f3a"] }, "legend": { "descending": true } } } }',
    description:
      "R² in LocusZoom's five bins, the colors a GWAS track's LD coloring paints",
  },
]
