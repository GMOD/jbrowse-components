# Diagrams

Graphviz sources for the architecture and pipeline figures used in the docs.
These replace hand-drawn PNGs and ASCII blocks so the figures are
version-controllable and easy to edit.

Each `<name>.dot` renders to `../static/img/<name>.png` — `diagrams.ts` owns
that mapping, so nothing here needs to restate it.

| Source                          | Used in                                           |
| ------------------------------- | ------------------------------------------------- |
| `products_and_plugins.dot`      | `docs/developer_guide.md` (Products and plugins)  |
| `product_architecture.dot`      | `docs/developer_guide.md` (state model / React)   |
| `wolfdog_ancestry_pipeline.dot` | `docs/tutorials/local_ancestry.md` (The pipeline) |
| `feature_plotting_threads.dot`  | `docs/developer_guides/plotting_features.md`      |
| `gpu_display_lifecycle.dot`     | `docs/developer_guides/creating_gpu_display.md`   |
| `gpu_display_tldr.dot`          | same page, the simplified version above it        |

## Editing one

Edit the `.dot`, then from the repo root:

```sh
pnpm diagrams        # renders every source, rewrites diagrams.lock
pnpm figures:push    # uploads the bytes, rewrites figures.lock
```

Commit `diagrams.lock` and `figures.lock` together with the `.dot`. Needs the
Graphviz `dot` CLI (`brew install graphviz` or `apt install graphviz`); the DPI
lives in `diagrams.ts` rather than in a command anyone can paste half of.

`static/img/` is gitignored, so **a re-render nobody pushed is invisible to
git**. For an ordinary figure that is merely a hazard. For a diagram it is
worse: the `.dot` is tracked, so a commit can show a source edit while the site
keeps serving the picture the old source produced, and `figures.lock` agrees
with the store the entire time.

`pnpm diagrams:check` is the gate for that, in the `Generated files up to date`
CI job. It compares each source's hash against the figure hash recorded beside
it in `diagrams.lock`, which is why there is no flag that just records the
current state: the only way to make the check pass is to actually render.
