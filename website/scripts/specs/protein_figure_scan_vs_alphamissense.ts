import { deflateSync } from 'node:zlib'

import { UCSC_HG38_CONFIG } from '../screenshot-spec-helpers.ts'
import { PARK_CURSOR } from '../screenshot-spec-types.ts'
import { readSession } from './protein_variants.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// One fold painted twice from the genome: a saturation scan's score sampled per
// codon on the left (`color.field: 'track'`), AlphaMissense's mean per residue
// on the right, one camera. The genome view draws the same two variables at
// base resolution: the scan as a dot per missense change, AlphaMissense as the
// hub's four-row heatmap on the plugin's own ramp. The sessions come from
// /var/tmp/hero-figures/build_brca1.py and build_tp53.py; the camera is the
// auto-framed one read back in page and brought 0.70 (BRCA1) or 0.80 (TP53)
// of the way in, TP53's turned to look across the DNA axis. The data:
// BRCA1 SGE (Findlay 2018) every missense SNV and its residue mean, hosted at
// jbrowse.org/demos/brca1/; the TP53 CRISPR scan (Funk 2025) likewise at
// jbrowse.org/demos/tp53_sge/, positive = loss of function.

function figureSession(file: string) {
  const session = readSession(file)
  return `?config=${UCSC_HG38_CONFIG}&session=encoded-${deflateSync(
    JSON.stringify(session),
  ).toString('base64url')}`
}

function pill(text: string, selector: string) {
  return {
    type: 'text' as const,
    text,
    fontSize: 30,
    maxWidth: 700,
    anchor: {
      selector: `${selector} [data-testid="protein-view-molstar"]`,
      alignX: 'left' as const,
      alignY: 'top' as const,
    },
    dx: 16,
    dy: 52,
  }
}

function badge(text: string, selector: string) {
  return {
    type: 'circle' as const,
    text,
    fontSize: 22,
    radius: 15,
    anchor: { selector, alignX: 'left' as const, alignY: 'top' as const },
    dx: 20,
    dy: 14,
  }
}

function view(id: string) {
  return `[data-testid="view-container-${id}"]`
}

function scanVsAlphaMissense(
  name: string,
  file: string,
  { lgv, measured, predicted, measuredLabel }: Record<string, string>,
): ScreenshotSpec {
  const MEASURED = view(measured!)
  const PREDICTED = view(predicted!)
  return {
    mode: 'url',
    name,
    url: figureSession(file),
    readySelector: `body:has(${MEASURED} [data-testid="protein-view-ready"]):has(${PREDICTED} [data-testid="protein-view-ready"])`,
    readyTimeout: 300000,
    hideSelectors: [
      '.msp-viewport-controls',
      '.msp-viewport-top-left-controls',
      '.msp-background-tasks',
      '.msp-highlight-info',
      '[data-testid="header-alignment-quality"]',
    ],
    hideTooltip: true,
    viewportWidth: 1600,
    viewportHeight: 1300,
    actions: [
      { type: 'waitForAppSettled' },
      PARK_CURSOR,
      { type: 'delay', ms: 800 },
    ],
    annotations: [
      pill(measuredLabel!, MEASURED),
      pill('PREDICTED: AlphaMissense', PREDICTED),
      badge('A', view(lgv!)),
      badge('B', MEASURED),
      badge('C', PREDICTED),
    ],
  }
}

export const proteinScanVsAlphaMissenseSpecs: ScreenshotSpec[] = [
  scanVsAlphaMissense(
    'protein/brca1_sge_alphamissense',
    'brca1_sge_alphamissense.session.json',
    {
      lgv: 'lgv-BRCA1',
      measured: 'protein-BRCA1-measured',
      predicted: 'protein-BRCA1-predicted',
      measuredLabel: 'MEASURED: saturation genome editing',
    },
  ),
  scanVsAlphaMissense(
    'protein/tp53_scan_alphamissense',
    'tp53_scan_alphamissense.session.json',
    {
      lgv: 'lgv-TP53',
      measured: 'protein-TP53-measured',
      predicted: 'protein-TP53-predicted',
      measuredLabel: 'MEASURED: CRISPR missense scan',
    },
  ),
]
