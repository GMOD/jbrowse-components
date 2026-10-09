Under `DisplayUIProvider` a stock display draws your overlays and still imports
Material UI, so Material UI stays in your bundle. To keep it out of the module
graph, write a display on `DisplayChromeBase`, which takes `overlays` as a prop
and imports no toolkit.
