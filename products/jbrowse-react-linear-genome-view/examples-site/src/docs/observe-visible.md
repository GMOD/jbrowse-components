Key a fetch off `coarseDynamicBlocks`, the debounced twin of `dynamicBlocks`, or
a drag fires one per frame. Two fetches can resolve out of order; the generation
counter keeps the older one from landing last.
