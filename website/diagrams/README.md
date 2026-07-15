# Architecture diagrams

Graphviz sources for the architecture figures used in the developer guide. These
replace the old hand-drawn PNGs so the figures are version-controllable and easy
to edit.

| Source                     | Rendered output                          | Used in                                          |
| -------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `products_and_plugins.dot` | `../static/img/products_and_plugins.png` | `docs/developer_guide.md` (Products and plugins) |
| `product_architecture.dot` | `../static/img/product_architecture.png` | `docs/developer_guide.md` (state model / React)  |

## Rendering

Render each `.dot` to PNG with the Graphviz `dot` CLI (`brew install graphviz`
or `apt install graphviz`):

```sh
dot -Tpng -Gdpi=150 products_and_plugins.dot -o ../static/img/products_and_plugins.png
dot -Tpng -Gdpi=150 product_architecture.dot -o ../static/img/product_architecture.png
```

Edit the `.dot` source and re-run the command above to update a figure. The
`-Gdpi=150` flag keeps the text crisp at the size shown in the docs.
