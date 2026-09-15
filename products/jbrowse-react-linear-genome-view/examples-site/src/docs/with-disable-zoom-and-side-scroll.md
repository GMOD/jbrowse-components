The stubs also stop `navTo`, `moveTo` and `navToLocString`, so the view opens at
its default scale: pin `bpPerPx` and `offsetPx` in a `defaultSession` instead.
Header controls go inert while still looking live, which is why this demo hides
the header.
