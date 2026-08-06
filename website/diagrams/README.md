# Architecture diagrams

Graphviz sources for the architecture and pipeline figures used in the docs.
These replace hand-drawn PNGs and ASCII diagrams so the figures are
version-controllable and easy to edit.

| Source                          | Rendered output                               | Used in                                           |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `products_and_plugins.dot`      | `../static/img/products_and_plugins.png`      | `docs/developer_guide.md` (Products and plugins)  |
| `product_architecture.dot`      | `../static/img/product_architecture.png`      | `docs/developer_guide.md` (state model / React)   |
| `wolfdog_ancestry_pipeline.dot` | `../static/img/wolfdog_ancestry_pipeline.png` | `docs/tutorials/local_ancestry.md` (The pipeline) |
| `feature_plotting_threads.dot`  | `../static/img/feature_plotting_threads.png`  | `docs/developer_guides/plotting_features.md`      |
| `gpu_display_lifecycle.dot`     | `../static/img/gpu_display_lifecycle.png`     | `docs/developer_guides/creating_gpu_display.md`   |

## Rendering

Render every `.dot` to PNG with the Graphviz `dot` CLI (`brew install graphviz`
or `apt install graphviz`):

```sh
for f in *.dot; do dot -Tpng -Gdpi=150 "$f" -o "../static/img/${f%.dot}.png"; done
pnpm figures:push   # from the repo root, then commit figures.lock
```

Edit the `.dot` source and re-run that to update a figure. The `-Gdpi=150` flag
keeps the text crisp at the size shown in the docs. `static/img/` is gitignored,
so a re-render is only visible to anyone else once it is pushed to the figure
store.
