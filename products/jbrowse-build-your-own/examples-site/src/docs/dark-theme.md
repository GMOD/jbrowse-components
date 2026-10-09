With `mode` left off, the tracks follow the page's CSS `color-scheme`: the OS
preference where the page declares `light dark`, and light where it declares
nothing. The worker draws feature labels into the image it returns, so `mode`
goes to the worker as well. For that, mount `EmbedProvider` or
`SessionPaletteProvider`, and not `PaletteProvider` alone.
