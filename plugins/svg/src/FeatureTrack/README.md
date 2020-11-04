# SVG Feature Renderer

## Process

The SVG Feature renderer has two steps:

- **Layout**: Each feature, subfeature, and label is laid out so that they are
  all allocated the proper space. First, `layOut` is called on the top-level
  feature, and then that function is responsible for calling `layOut` on its
  subfeatures. The default `layOut` function just calls `layOut` on all the
  subfeatures. The `layOut` function can be customized by a glyph by providing a
  `layOut` method on the Glyph function. This can be used to e.g. filter certain
  subfeatures so they are not displayed or manipulate the position of the
  subfeatures.

- **Render**: Each glyph is a React component that returns a valid SVG element.
  It positions itself using the `featureLayout` prop. Each rendered feature has its own glyph.

## Glyphs

- **Box**: A simple rectangle from the start to the end of a feature.

- **Chevron**: A rectangle that is pointed/indented at the ends. It points
  itself according to the feature's strand.

- **ProcessedTranscript**: A `Segments` glyph that only lays out/renders its
  subfeatures that are of type CDS, UTR, five_prime_UTR, or three_prime_UTR.

- **Segments**: A glyph that draws a line from the start to the end of a
  feature. The subfeatures are drawn on top of this line.

- **Subfeatures**: Does not render the feature itself, but renders its
  subfeatures so they are vertically offset from each other.
