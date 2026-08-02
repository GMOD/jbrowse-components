#!/usr/bin/env python3
"""Pull one cell line out of a DepMap Omics release into JBrowse-ready files, for
website/docs/tutorials/cancer_sv.md.

DepMap publishes STAR-Fusion calls and copy-number segments for ~1900 cell lines
as two big CSVs keyed by model/profile id. Both carry the columns JBrowse wants,
just in the wrong shape:

  fusions   OmicsFusionFiltered.csv -> star-fusion.fusion_predictions.tsv, which
            is what StarFusionAdapter parses (it keys off a '#'-prefixed header
            with LeftBreakpoint/RightBreakpoint columns)

  segments  OmicsCNSegmentsProfile.csv -> bedGraph of the segment copy ratio

Model and profile ids come from Model.csv / OmicsProfiles.csv in the same
release; K562 is ACH-000551, whose WGS profile is PR-aheaZL.

Usage:
  depmap_to_jbrowse.py fusions  OmicsFusionFiltered.csv    ACH-000551 out.tsv
  depmap_to_jbrowse.py segments OmicsCNSegmentsProfile.csv PR-aheaZL  out.bedGraph
"""

import csv
import sys

# everything except the DepMap-only bookkeeping columns, in STAR-Fusion's order
STARFUSION_COLUMNS = [
    'FusionName',
    'JunctionReadCount',
    'SpanningFragCount',
    'SpliceType',
    'LeftGene',
    'LeftBreakpoint',
    'RightGene',
    'RightBreakpoint',
    'LargeAnchorSupport',
    'FFPM',
    'LeftBreakDinuc',
    'LeftBreakEntropy',
    'RightBreakDinuc',
    'RightBreakEntropy',
    'annots',
]


def fusions(source, model_id, out_path):
    rows = [r for r in csv.DictReader(open(source)) if r['ModelID'] == model_id]
    if not rows:
        sys.exit(f'no fusion calls for {model_id} in {source}')
    # strongest evidence first, so the track reads top-down like the caller's own
    # output rather than in DepMap's arbitrary order
    rows.sort(key=lambda r: -float(r['FFPM']))
    with open(out_path, 'w') as out:
        out.write('#' + '\t'.join(STARFUSION_COLUMNS) + '\n')
        for r in rows:
            out.write('\t'.join(r.get(c, '') or '.' for c in STARFUSION_COLUMNS) + '\n')
    print(f'{len(rows)} fusion calls -> {out_path}')


def segments(source, profile_id, out_path):
    rows = [r for r in csv.DictReader(open(source)) if r['ProfileID'] == profile_id]
    if not rows:
        sys.exit(f'no copy-number segments for {profile_id} in {source}')
    rows.sort(key=lambda r: (r['Chromosome'], int(r['Start'])))
    with open(out_path, 'w') as out:
        for r in rows:
            # DepMap names chromosomes bare; the alignments and the reference use chr
            chrom = r['Chromosome']
            chrom = chrom if chrom.startswith('chr') else 'chr' + chrom
            out.write(f"{chrom}\t{int(r['Start']) - 1}\t{r['End']}\t{r['SegmentMean']}\n")
    print(f'{len(rows)} segments -> {out_path}')


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    command, source, key, out_path = sys.argv[1:]
    if command == 'fusions':
        fusions(source, key, out_path)
    elif command == 'segments':
        segments(source, key, out_path)
    else:
        sys.exit(f'unknown command {command}')


if __name__ == '__main__':
    main()
