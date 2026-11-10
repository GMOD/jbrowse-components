---
name: keep-the-sample-distance-matrix-resident
description: The GPU sample distance matrix goes back to the worker for hclust and is dropped; kept on the GPU, a few power iterations give a local-PCA ordering per window and one row gives compare-to-selected shading, with no new kernel.
---

# Keep the sample distance matrix resident

`clusterMatrix` dispatches `gpuDistanceMatrix` for a population panel, reads the
N×N matrix back to the worker, hands it to hclust and lets it go
([CLUSTERING_WORKFLOW](../../reference/CLUSTERING_WORKFLOW.md) §"The distance
build, measured"). Two more pictures come from the same matrix:

- **Local PCA.** A few power iterations give PC1 and an ordering by it. Its
  point is that the answer differs per window, which is what the clustering
  dialog's one-shot tree does not show.
- **Compare to selected.** One row of the matrix shades every other row by its
  distance to a clicked sample in the window, the sample analog of the LD
  index-SNP view.

Neither needs another kernel; both need the matrix kept on the device between
the cluster run and the next click, and a home for it that a window change
invalidates. The call is whether either picture earns a place in the variant
display's menus beside clustering, since both reorder or recolor rows the user
may have arranged.

Lane ordering on a synteny star wants the same PC1 over each lane's identity
profile ([ordering-synteny-lanes-by-similarity](ordering-synteny-lanes-by-similarity.md)).
