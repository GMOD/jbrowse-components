`DisplayUIProvider` changes what a stock display renders, not what it imports:
Material UI still ships in your bundle, and nothing draws it. To keep it out of
the module graph, write your own display on `DisplayChromeBase`, which takes
`overlays` as a prop and imports no toolkit.
