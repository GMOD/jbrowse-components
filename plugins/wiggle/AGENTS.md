# Wiggle Plugin Notes

## Rendering Architecture

Data is uploaded per-region and rendered per-block with scissor/viewport clipping.
Each block maps to a region with its own GPU buffer and regionStart. A single-pass
approach would require a combined buffer re-upload whenever any region changes,
which is worse for scrolling where typically only one region updates. Per-block
draw call overhead is small relative to the data upload cost.
