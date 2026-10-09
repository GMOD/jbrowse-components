Leave `mode` off and the engine follows the page's CSS `color-scheme`: the OS
preference where the page declares `light dark`, and light where it declares
nothing. `mode` reaches the worker too, which bakes feature labels into the
image it returns, so mount `EmbedProvider` or `SessionPaletteProvider` and not
`PaletteProvider` alone.
