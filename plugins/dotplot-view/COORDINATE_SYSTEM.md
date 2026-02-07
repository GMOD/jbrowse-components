# Dotplot Coordinate System

## Overview

The dotplot renderer uses a clear, simple coordinate transformation system to map genomic positions to screen pixels.

## Coordinate Spaces

### 1. Genomic Coordinates (bp)
- Position along a chromosome in base pairs
- Example: position 1,000,000 on chr1
- Both query and target sequences have genomic coordinates

### 2. View Coordinates (px)
- Pixel position within the entire scrollable plot area
- Origin (0,0) at the top-left corner of the maximum plot extent
- Ranges from 0 to the full plot width/height (can extend beyond visible area)
- This is the coordinate space used by `offsetPx` in block data

### 3. Viewport Coordinates (px)
- Pixel position within the visible viewport
- Origin (0,0) at the top-left of the visible plot area
- Ranges from 0 to viewWidth/viewHeight
- This is what we render: viewport coords are visible on screen

### 4. NDC Coordinates (normalized device coordinates)
- Ranges from -1 to 1 in both axes
- (-1,-1) is bottom-left, (1,1) is top-right
- This is what WebGL uses for rendering

## Transformation Pipeline

### Genomic → View Coordinates
```
pixelPos = bpToPx({ self: viewSnap, refName, coord })
// bpToPx returns { offsetPx: ... }
// offsetPx is position within the scrollable view
```

### View → Viewport Coordinates
```
viewportX = viewCoord.x - scrollOffsetX
viewportY = viewCoord.y - scrollOffsetY
// scrollOffset is view.{h|v}view.offsetPx
```

### Viewport → NDC Coordinates
```
ndcX = (viewportX / viewportWidth) * 2.0 - 1.0
ndcY = -(viewportY / viewportHeight) * 2.0 + 1.0  // Y is inverted
```

## Key Components

### DotplotView
- `hview`, `vview`: 1D views for horizontal and vertical axes
- `width`, `height`: Total view size including borders
- `viewWidth`, `viewHeight`: Plot area size (width/height - border)
- `borderX`, `borderY`: Size of axis label areas
- `hview.offsetPx`, `vview.offsetPx`: Current scroll offset

### DotplotDisplay WebGL Rendering
1. **RPC (executeDotplotWebGLGeometry)**
   - Input: Features (genomic coords), view snapshots
   - Uses `bpToPx` to convert to view coordinates
   - Output: Arrays of view-space pixel coordinates

2. **Main Thread (afterAttach)**
   - Receives view-space coordinates from RPC
   - Creates FeatPos objects with `{ x1, y1, x2, y2 }` in view space
   - Triggers `buildGeometry` with color function

3. **WebGL Renderer (DotplotWebGLRenderer)**
   - `buildGeometry`: Receives view-space coordinates, uploads to GPU
   - `render(offsetX, offsetY)`:
     - Passes scroll offset to shader as uniform `u_offset`
     - Shader subtracts offset to get viewport coords
     - Shader converts to NDC and renders

4. **Axes/Gridlines (DotplotAxesCanvas)**
   - Separate 2D canvas overlay
   - Renders on top of WebGL for clarity
   - Also applies scroll offsets to position gridlines correctly

## Important Notes

### Y-Axis Inversion
- Screen coordinates: Y increases downward
- Genomic coordinates: Y represents vertical position
- In RPC: `y = height - offsetPx` to flip coordinate system
- In WebGL: `-y` in NDC transformation to correct perspective

### Scroll Offset Handling
- `view.{h|v}view.offsetPx` represents the top-left corner of the viewport in view-space coordinates
- Vertices are in view-space (absolute plot coordinates)
- Shader applies offset: `relativePos = a_position - u_offset`
- This maps view-space coords to viewport-space (visible area)

### Border Handling
- DotplotAxesCanvas and DotplotWebGLCanvas position themselves with borders
- Canvas is positioned absolutely at (borderX, borderY)
- Canvas size is viewWidth × viewHeight (excluding borders)
- Axes canvas renders gridlines and labels in the border area and plot area

## Debugging

Enable detailed logging by checking browser console:
- `executeDotplotWebGLGeometry`: Shows RPC input/output coordinates
- `DotplotWebGLRenderer`: Shows geometry build and render calls
- `DotplotWebGLCanvas`: Shows canvas initialization
- `dotplotDrawAutorun`: Shows rendering parameters

Each log includes relevant coordinates and dimensions to verify transformations are correct.
