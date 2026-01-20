# Display Settings Missing Config Schema Analogs

This document tracks runtime display settings that users can toggle via menus
but cannot configure as defaults in track configuration files.

## Background

JBrowse displays have two layers of configuration:

1. **Config Schema** - Static defaults set in config.json/track configs
2. **Model State** - Runtime overrides toggled via menus, stored in session

Many useful settings exist only in Model State, meaning track authors cannot
pre-configure behaviors without users having to toggle them each time.

## Priority Levels

- **P1 (High)** - Frequently requested, high user impact
- **P2 (Medium)** - Useful for power users, moderate impact
- **P3 (Low)** - Niche use cases, low impact

---

## Alignments Plugin

### LinearPileupDisplay

| Setting            | Type    | Default | Priority | Notes                            |
| ------------------ | ------- | ------- | -------- | -------------------------------- |
| `showSoftClipping` | boolean | false   | P1       | Show soft clipping indicators    |
| `mismatchAlpha`    | boolean | -       | P1       | Fade mismatches by quality score |
| `featureHeight`    | number  | -       | P2       | Height of each read              |
| `noSpacing`        | boolean | -       | P2       | Remove spacing between reads     |
| `trackMaxHeight`   | number  | -       | P2       | Maximum layout height            |
| `hideSmallIndels`  | boolean | false   | P2       | Hide small indel markers         |
| `hideMismatches`   | boolean | false   | P2       | Hide mismatch markers            |
| `hideLargeIndels`  | boolean | false   | P2       | Hide large indel markers         |

### LinearSNPCoverageDisplay

| Setting                   | Type    | Default | Priority | Notes                                  |
| ------------------------- | ------- | ------- | -------- | -------------------------------------- |
| `showInterbaseCounts`     | boolean | -       | P1       | Show insertion/clipping counts         |
| `showInterbaseIndicators` | boolean | -       | P1       | Show insertion/clipping indicators     |
| `showArcs`                | boolean | -       | P2       | Show sashimi arcs for splice junctions |
| `minArcScore`             | number  | 0       | P2       | Minimum score for arcs to display      |

### LinearReadArcsDisplay

| Setting         | Type    | Default | Priority | Notes                              |
| --------------- | ------- | ------- | -------- | ---------------------------------- |
| `drawInter`     | boolean | true    | P2       | Show inter-chromosomal connections |
| `drawLongRange` | boolean | true    | P2       | Show long-range connections        |

### LinearReadCloudDisplay

| Setting           | Type    | Default | Priority | Notes                                |
| ----------------- | ------- | ------- | -------- | ------------------------------------ |
| `drawCloud`       | boolean | false   | P2       | Show as read cloud (paired-end mode) |
| `showYScalebar`   | boolean | true    | P3       | Show y-axis scalebar in cloud mode   |
| `showOutline`     | boolean | true    | P3       | Draw outline around reads            |
| `drawSingletons`  | boolean | -       | P3       | Draw singleton reads                 |
| `drawProperPairs` | boolean | -       | P3       | Draw proper pairs                    |

### LinearAlignmentsDisplay

| Setting          | Type   | Default               | Priority | Notes                             |
| ---------------- | ------ | --------------------- | -------- | --------------------------------- |
| `snpCovHeight`   | number | 45                    | P2       | Height of SNP coverage subdisplay |
| `lowerPanelType` | string | 'LinearPileupDisplay' | P3       | Type of lower panel display       |

---

## Wiggle Plugin

### LinearWiggleDisplay

| Setting               | Type    | Default | Priority | Notes                                   |
| --------------------- | ------- | ------- | -------- | --------------------------------------- |
| `displayCrossHatches` | boolean | -       | P1       | Show cross-hatch pattern                |
| `summaryScoreMode`    | enum    | -       | P1       | Score aggregation: min/max/avg/whiskers |
| `fill`                | boolean | -       | P2       | Fill area under plot                    |
| `color`               | string  | -       | P2       | Custom color override                   |
| `posColor`            | string  | -       | P2       | Positive values color                   |
| `negColor`            | string  | -       | P2       | Negative values color                   |
| `resolution`          | number  | 1       | P3       | Data resolution                         |

### MultiLinearWiggleDisplay

| Setting                                     | Type    | Default | Priority | Notes                           |
| ------------------------------------------- | ------- | ------- | -------- | ------------------------------- |
| `showSidebar`                               | boolean | true    | P2       | Show sidebar with source legend |
| (inherits all LinearWiggleDisplay settings) |         |         |          |                                 |

---

## Linear Genome View Plugin

### LinearBasicDisplay

| Setting                           | Type    | Default | Priority | Notes                                      |
| --------------------------------- | ------- | ------- | -------- | ------------------------------------------ |
| `trackShowLabels`                 | boolean | -       | P1       | Show feature labels                        |
| `trackShowDescriptions`           | boolean | -       | P1       | Show feature descriptions                  |
| `trackDisplayMode`                | enum    | -       | P1       | Display mode (compact, normal, collapse)   |
| `trackGeneGlyphMode`              | enum    | -       | P2       | Gene glyph mode: all/longest/longestCoding |
| `trackSubfeatureLabels`           | enum    | -       | P2       | Subfeature labels: none/below/overlay      |
| `trackDisplayDirectionalChevrons` | boolean | -       | P2       | Show directional chevrons                  |
| `trackMaxHeight`                  | number  | -       | P3       | Maximum track height                       |

---

## Variants Plugin

### LinearVariantDisplay

| Setting                                | Type   | Default | Priority | Notes                        |
| -------------------------------------- | ------ | ------- | -------- | ---------------------------- |
| `minorAlleleFrequencyFilter`           | number | 0       | P2       | MAF filter threshold (0-0.5) |
| (inherits LinearBasicDisplay settings) |        |         |          |                              |

### MultiLinearVariantDisplay / LinearVariantMatrixDisplay

**Already addressed** - Config slots added for:

- `showReferenceAlleles`
- `showSidebarLabels`
- `showTree`
- `renderingMode`
- `minorAlleleFrequencyFilter`
- `colorBy`

---

## Hi-C Plugin

### LinearHicDisplay

| Setting               | Type    | Default      | Priority | Notes                                |
| --------------------- | ------- | ------------ | -------- | ------------------------------------ |
| `resolution`          | number  | 1            | P2       | Hi-C resolution                      |
| `useLogScale`         | boolean | false        | P2       | Use log scale for colors             |
| `colorScheme`         | string  | -            | P2       | Color scheme name (e.g., 'juicebox') |
| `activeNormalization` | string  | 'KR'         | P2       | Normalization method                 |
| `mode`                | enum    | 'triangular' | P3       | Display mode: triangular/adjust      |

---

## Arc Plugin

### LinearArcDisplay

| Setting       | Type | Default | Priority | Notes                          |
| ------------- | ---- | ------- | -------- | ------------------------------ |
| `displayMode` | enum | -       | P2       | Display mode: arcs/semicircles |

---

## Dotplot Plugin

### DotplotDisplay

| Setting              | Type   | Default   | Priority | Notes                           |
| -------------------- | ------ | --------- | -------- | ------------------------------- |
| `colorBy`            | string | 'default' | P2       | Color scheme                    |
| `alpha`              | number | 1         | P3       | Transparency (0-1)              |
| `minAlignmentLength` | number | 0         | P3       | Min alignment length to display |

---

## Common Patterns (Multiple Displays)

These settings appear across multiple displays and could benefit from a shared
approach:

| Setting          | Displays                                    | Priority | Notes                   |
| ---------------- | ------------------------------------------- | -------- | ----------------------- |
| `showLegend`     | Pileup, SNPCoverage, ReadCloud, Wiggle, Hic | P1       | Show legend panel       |
| `showTooltips`   | Wiggle displays                             | P2       | Enable tooltips         |
| `trackMaxHeight` | Most feature displays                       | P2       | Maximum layout height   |
| `jexlFilters`    | Most displays                               | P2       | JEXL filter expressions |

---

## Implementation Notes

### Pattern to Follow

Based on the MultiVariant display implementation:

1. Add config slot to `configSchema.ts`:

```typescript
showSoftClipping: {
  type: 'boolean',
  defaultValue: false,
  description: 'Show soft clipping indicators by default',
}
```

2. Rename model property with `Setting` suffix:

```typescript
showSoftClippingSetting: types.maybe(types.boolean),
```

3. Add getter that falls back to config:

```typescript
get showSoftClipping() {
  return self.showSoftClippingSetting ?? getConf(self, 'showSoftClipping')
}
```

4. Update action to use new property name:

```typescript
setShowSoftClipping(val: boolean) {
  self.showSoftClippingSetting = val
}
```

5. Update `postProcessSnapshot` to handle new property name

### Renderer Config vs Display Config

Some settings exist in renderer configs but not display configs (e.g.,
`mismatchAlpha` in PileupRenderer). Consider:

- Adding display-level config that overrides renderer config
- Or documenting that users should configure at renderer level

### Testing

Each new config slot should have tests verifying:

1. Config default is used when state is undefined
2. State value overrides config when set
3. Config value can be set in track configuration

---

## Suggested Implementation Order

### Phase 1: High-Impact Alignment Settings

1. LinearPileupDisplay: `showSoftClipping`, `mismatchAlpha`
2. LinearSNPCoverageDisplay: `showInterbaseCounts`, `showInterbaseIndicators`

### Phase 2: Feature Display Settings

3. LinearBasicDisplay: `trackShowLabels`, `trackShowDescriptions`,
   `trackDisplayMode`
4. LinearWiggleDisplay: `displayCrossHatches`, `summaryScoreMode`

### Phase 3: Secondary Settings

5. Remaining P2 settings as needed
6. Common `showLegend` pattern across displays

---

## Related Issues/PRs

- (Add links to related issues as they're created)

---

_Last updated: 2026-01-20_
