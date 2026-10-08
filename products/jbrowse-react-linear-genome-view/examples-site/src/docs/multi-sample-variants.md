`rowColor` is a config slot, read once when sources load, so it goes on the
display config rather than a `displaySnapshot`. A track opens its first
configured display, so `LinearMultiSampleVariantDisplay` has to come first in
`displays`.
