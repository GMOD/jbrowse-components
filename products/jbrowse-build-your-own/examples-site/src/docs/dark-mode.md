Leave `mode` off and the engine follows the page's CSS `color-scheme`, then the
OS preference. `mode` reaches the worker too, which bakes feature labels into
the image it returns, so mount `EmbedProvider` or `SessionPaletteProvider` and
not `PaletteProvider` alone.
