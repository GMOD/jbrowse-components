# Introgression Visualization for Multi-Sample Variant View

This document describes the new introgression visualization feature added to JBrowse's multi-sample variant view.

## Overview

The introgression visualization uses ABBA-BABA patterns and Patterson's D-statistic to detect and visualize genetic introgression between populations. This method is straightforward to compute from raw VCF genotypes without requiring external tools.

## Features

### 1. ABBA-BABA Analysis
- Calculates ABBA and BABA site patterns from VCF genotypes
- Computes Patterson's D-statistic: D = (ABBA - BABA) / (ABBA + BABA)
- Calculates Z-score to assess statistical significance
- Displays pairwise allele frequency differences between populations

### 2. Population Assignment
- **Manual assignment**: Users can assign samples to populations (P1, P2, P3, Outgroup) via UI
- **Auto-assignment from clustering**: Automatically assigns populations based on hierarchical clustering tree
- Interactive dialog with color-coded population groups

### 3. Visualization
- D-statistic bar chart with significance coloring
- Pairwise allele frequency difference graphs
- Population summary with sample counts
- Real-time calculation with loading indicators

## Files Created

### RPC Method
- `VariantRPC/MultiVariantIntrogressionMatrix.ts` - Calculates ABBA-BABA patterns and D-statistics from VCF data

### Display Components
- `MultiLinearVariantIntrogressionDisplay/model.ts` - State model extending MultiVariantBaseModel
- `MultiLinearVariantIntrogressionDisplay/components/IntrogressionDisplayComponent.tsx` - Main display component
- `MultiLinearVariantIntrogressionDisplay/components/PopulationConfigDialog.tsx` - Population assignment UI
- `MultiLinearVariantIntrogressionDisplay/index.ts` - Display type registration

### Renderer
- `MultiLinearVariantIntrogressionRenderer/MultiLinearVariantIntrogressionRenderer.ts` - Canvas renderer for visualization
- `MultiLinearVariantIntrogressionRenderer/index.ts` - Renderer registration

## How It Works

### Theory
The ABBA-BABA test uses a four-taxon tree: ((P1,P2),P3,Outgroup)

- **ABBA pattern**: P1 has ancestral allele, P2 and P3 have derived allele
- **BABA pattern**: P1 has derived allele, P2 has ancestral allele, P3 has derived allele
- **D-statistic interpretation**:
  - D = 0: No introgression (equal ABBA and BABA)
  - D > 0: Introgression from P3 into P2
  - D < 0: Introgression from P3 into P1
  - |Z| > 3: Statistically significant

### Implementation

1. **Genotype Processing**:
   - Extracts genotypes from VCF for each population
   - Calculates allele frequencies for each variant
   - Identifies ABBA and BABA patterns

2. **D-statistic Calculation**:
   ```typescript
   ABBA = (1 - p1) * p2 * p3 * (1 - outgroup)
   BABA = p1 * (1 - p2) * p3 * (1 - outgroup)
   D = (ABBA - BABA) / (ABBA + BABA)
   ```

3. **Visualization**:
   - Main D-statistic bar with color-coded significance
   - Pairwise allele frequency differences (P1-P2, P1-P3, P2-P3)
   - Population labels with sample counts

## Usage

1. Open a multi-sample VCF track in JBrowse
2. Select "Multi-sample introgression display" from display options
3. Click "Configure Populations" button
4. Assign samples to populations (P1, P2, P3, Outgroup):
   - **Option 1**: Manually select samples for each population
   - **Option 2**: Enable "Auto-assign from clustering tree" (requires running clustering first)
5. Click "Calculate Introgression"
6. View the D-statistic and pairwise comparisons

## Interpretation

### D-statistic Bar
- **Gray**: Not significant (|Z| < 3)
- **Blue**: Significant introgression into P1
- **Red**: Significant introgression into P2
- Darker colors indicate stronger signals (|Z| > 5)

### Pairwise Plots
- Show allele frequency differences across variants
- Higher values indicate greater differentiation
- Red line shows mean difference

### Statistics Display
- **D**: D-statistic value (-1 to +1)
- **Z**: Z-score for significance testing
- **Significance**: Flagged if |Z| > 3

## Technical Notes

### Population Structure
For valid ABBA-BABA analysis, ensure:
- P1 and P2 form a clade (sister populations)
- P3 is an outgroup to (P1, P2)
- Outgroup is ancestral to all three populations

### Auto-assignment Algorithm
When auto-assigning from clustering:
- Outgroup: First 15% of samples from clustering
- P1, P2, P3: Remaining samples divided into thirds
- Works best with clear population structure

### Performance
- Calculations run via RPC for efficient processing
- Results cached until populations change
- Recalculation available via "Recalculate" button

## References

1. Green et al. (2010) "A draft sequence of the Neandertal genome" - Original ABBA-BABA method
2. Durand et al. (2011) "Testing for ancient admixture" - D-statistic formalization
3. Martin et al. (2015) "Evaluating the use of ABBA–BABA statistics" - Method review

## Future Enhancements

Potential additions:
- Windowed D-statistic along chromosomes
- f4-ratio statistic for admixture proportions
- Block jackknife for standard errors
- Multiple population comparisons
- Export results to CSV/TSV
