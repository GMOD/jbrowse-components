---
id: config_dotplot_view
title: Dotplot view config
---

### Setup

An example of a dotplot config can help explain. This is relatively advanced so
let's step through it

1. We setup two assemblies, one for grape, one for peach (only chrom.sizes
   files used)
2. Then we setup a "dotplot track" because multiple layers can be plotted on a
   dotplot. We use a PAFAdapter
3. Then we instantiate a savedSession containing the whole genome, by setting
   displayedRegions to be empty

```json
{
  "assemblies": [
    {
      "name": "grape",
      "sequence": {
        "trackId": "grape_seq",
        "type": "ReferenceSequenceTrack",
        "adapter": {
          "type": "ChromSizesAdapter",
          "chromSizesLocation": {
            "uri": "test_data/grape.chrom.sizes"
          }
        }
      }
    },
    {
      "name": "peach",
      "sequence": {
        "trackId": "peach_seq",
        "type": "ReferenceSequenceTrack",
        "adapter": {
          "type": "ChromSizesAdapter",
          "chromSizesLocation": {
            "uri": "test_data/peach.chrom.sizes"
          }
        }
      }
    }
  ],
  "tracks": [
    {
      "type": "DotplotTrack",
      "trackId": "dotplot_track",
      "name": "dotplot",
      "assemblyNames": ["grape", "peach"],
      "adapter": {
        "type": "PAFAdapter",
        "pafLocation": {
          "uri": "test_data/peach_grape.paf"
        },
        "assemblyNames": ["peach", "grape"]
      },
      "renderer": {
        "type": "DotplotRenderer"
      }
    }
  ],
  "savedSessions": [
    {
      "name": "Grape vs Peach",
      "views": [
        {
          "id": "dotplotview",
          "type": "DotplotView",
          "assemblyNames": ["peach", "grape"],
          "hview": {
            "displayedRegions": [],
            "bpPerPx": 100000,
            "offsetPx": 0
          },
          "vview": {
            "displayedRegions": [],
            "bpPerPx": 100000,
            "offsetPx": 0
          },
          "tracks": [
            {
              "type": "DotplotTrack",
              "configuration": "dotplot_track"
            }
          ],
          "height": 600,
          "displayName": "Grape vs Peach dotplot",
          "trackSelectorType": "hierarchical"
        }
      ]
    }
  ]
}
```

### Notes

The dotplot view is still very new and has not received much polish, and parts
of this config could change in the future
