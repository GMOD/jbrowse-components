# Canvas Feature Renderer

A canvas-based feature renderer converted from the SvgFeatureRenderer. This renderer draws genomic features to an HTML5 canvas for improved performance with large numbers of features.

## Architecture

The Canvas Feature Renderer follows a two-phase approach:

1. **Layout Phase** (in worker): Computes feature positions and collision detection
2. **Rendering Phase** (in worker): Draws features to canvas and creates spatial index

## Key Components

### Main Renderer Class
- **CanvasFeatureRenderer.ts**: Main renderer extending `BoxRendererType`
  - Fetches features
  - Computes layouts
  - Renders to canvas using `renderToAbstractCanvas`

### Drawing Functions
- **drawBox.ts**: Draws rectangular box glyphs
- **drawArrow.ts**: Draws directional arrows for stranded features
- **drawSegments.ts**: Draws connecting lines for segmented features
- **drawFeature.ts**: Main dispatcher that routes to appropriate drawing function
- **drawProcessedTranscript**: Special handling for transcript features with CDS/UTRs

### Layout Functions
- **simpleLayout.ts**: Simple coordinate-based layout (no SceneGraph complexity)
  - `layoutFeature`: Creates layout tree with manual coordinate tracking
  - `findFeatureLayout`: Finds a specific feature in the layout tree
  - `getLayoutWidth`/`getLayoutHeight`: Calculate dimensions
  - Stacks transcripts vertically within genes
  - Overlays CDS/UTR within transcripts

### Core Logic
- **makeImageData.ts**: Main rendering coordinator
  - `makeImageData`: Draws all features to canvas context
  - `computeLayouts`: Pre-computes feature layouts for collision detection
  - Creates Flatbush spatial index for hit testing

### Utilities
- **util.ts**: Helper functions
  - `chooseGlyphType`: Determines which glyph to use for a feature
  - `getBoxColor`: Calculates feature colors (including CDS frame coloring)
  - `isUTR`: Identifies UTR features
- **filterSubparts.ts**: Subfeature filtering and UTR generation
  - `getSubparts`: Gets filtered subfeatures for transcripts
  - `makeUTRs`: Generates implied UTRs from exons and CDS

### Types
- **types.ts**: TypeScript type definitions

### Configuration
- **configSchema.ts**: Renderer configuration schema

## Glyph Types

The renderer supports multiple glyph types:

- **Box**: Simple rectangular features
- **Segments**: Features with connecting lines and subfeatures (e.g., genes with exons)
- **ProcessedTranscript**: Specialized for mRNA with CDS/UTR rendering
- **Subfeatures**: Container features with nested children
- **CDS**: Coding sequences (amino acid rendering not yet implemented)

## Spatial Indexing

Uses **Flatbush** for efficient spatial queries:
- Bounding boxes for all drawn elements stored during rendering
- Enables fast feature lookup on mouse interactions
- Replaces SVG's built-in hit testing

## Differences from SvgFeatureRenderer

| Aspect | SVG Renderer | Canvas Renderer |
|--------|--------------|-----------------|
| Rendering | React components | Canvas 2D API |
| Output | SVG elements | ImageBitmap |
| Hit testing | Native SVG | Flatbush spatial index |
| Performance | Good for few features | Better for many features |
| Text rendering | SVG `<text>` | `ctx.fillText()` |

## Future Enhancements

- [ ] Amino acid lettering for CDS features (currently just draws boxes)
- [ ] Per-base nucleotide rendering when zoomed in
- [ ] Additional custom glyph types via plugin system
- [ ] WebGL acceleration for very large feature sets

## Usage

The renderer is automatically registered when the SVG plugin is loaded:

```javascript
import SVGPlugin from '@jbrowse/plugin-svg'

// Renderer available as 'CanvasFeatureRenderer'
```

Configure in a track:

```json
{
  "type": "FeatureTrack",
  "renderer": {
    "type": "CanvasFeatureRenderer"
  }
}
```
