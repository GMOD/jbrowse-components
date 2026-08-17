# Diagrams

Graphviz sources for the architecture and pipeline figures used in the docs.
These replace hand-drawn PNGs and ASCII blocks so the figures are
version-controllable and easy to edit.

Each `<name>.dot` or `<name>.svg` renders to `../static/img/<name>.png` —
`diagrams.ts` owns that mapping, so nothing here needs to restate it.

**Which kind to write.** Graphviz is for a graph: nodes and edges whose
placement is a layout problem worth handing to a solver. A schematic laid out
along one axis has nothing for a solver to decide, and writing it as a digraph
means fighting the layout for coordinates you already knew — hand-author those
as SVG.

| Source                           | Used in                                           |
| -------------------------------- | ------------------------------------------------- |
| `dataflow.dot`                   | `docs/developer_guides/dataflow.md`               |
| `products_and_plugins.dot`       | `docs/developer_guide.md` (Products and plugins)  |
| `product_architecture.dot`       | `docs/developer_guide.md` (state model / React)   |
| `wolfdog_ancestry_pipeline.dot`  | `docs/tutorials/local_ancestry.md` (The pipeline) |
| `feature_plotting_threads.dot`   | `docs/developer_guides/plotting_features.md`      |
| `fetch_chain.dot`                | `docs/developer_guides/data_fetching.md`          |
| `rpc_lifecycle.dot`              | `docs/developer_guides/rpc_workers.md`            |
| `gpu_display_lifecycle.dot`      | `docs/developer_guides/creating_gpu_display.md`   |
| `gpu_display_tldr.dot`           | same page, the simplified version above it        |
| `inversion_pair_orientation.svg` | `docs/user_guides/sv_visualization.md`            |

## Editing one

Edit the `.dot`, then from the repo root:

```sh
pnpm diagrams        # renders every source, rewrites diagrams.lock
pnpm figures:push    # uploads the bytes, rewrites figures.lock
```

Commit `diagrams.lock` and `figures.lock` together with the source. Needs the
Graphviz `dot` CLI (`brew install graphviz` or `apt install graphviz`) and
`rsvg-convert` (`librsvg`); the DPI lives in `diagrams.ts` rather than in a
command anyone can paste half of, and both renderers take the same number.

`static/img/` is gitignored, so **a re-render nobody pushed is invisible to
git**. For an ordinary figure that is merely a hazard. For a diagram it is
worse: the source is tracked, so a commit can show a source edit while the site
keeps serving the picture the old source produced, and `figures.lock` agrees
with the store the entire time.

`pnpm diagrams:check` is the gate for that, in the `Generated files up to date`
CI job. It compares each source's hash against the figure hash recorded beside
it in `diagrams.lock`, which is why there is no flag that just records the
current state: the only way to make the check pass is to actually render.
