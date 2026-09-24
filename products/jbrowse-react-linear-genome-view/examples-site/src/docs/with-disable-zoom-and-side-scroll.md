The stubs also stop `navTo`, `moveTo` and `navToLocString`, so the view opens at
its default scale: pin the window in a `defaultSession` instead, with
`displayedRegions`, `windowStartBp` and `windowWidthBp`. Header controls go
inert while still looking live, which is why this demo hides the header.
