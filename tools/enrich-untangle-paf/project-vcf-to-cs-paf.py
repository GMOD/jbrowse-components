#!/usr/bin/env python3
"""Project a `vg deconstruct -a -u` VCF onto an `odgi untangle` PAF, emitting
a cs:-tagged PAF that the JBrowse MultiLGVSyntenyDisplay renders directly.

Sibling of `enrich-untangle-paf.py`. Same output shape (cs:Z:-enriched PAF
ready for bgzip + tabix), different derivation backend:

  * `enrich-untangle-paf.py` — runs `minimap2 --cs` per block on extracted
    subsequences. Sequence-only re-alignment, no graph awareness, discards
    node IDs. Pragmatic when no graph is available.

  * `project-vcf-to-cs-paf.py` (this script) — projects `vg deconstruct -a -u`
    AP/AT positioned variants onto each untangle block's target window. The
    graph's own per-base decomposition; no re-alignment; preserves snarl-aware
    variant calls. Default for HPRC and other graph-pangenome inputs.

Recipe:
    odgi build -g graph.gfa -o graph.og        # if not already
    odgi untangle -i graph.og -R ref-paths.txt -Q query-paths.txt -n 1 \\
        -j 0 -m 0 -p > untangle.paf
    vg convert -g graph.gfa -p > graph.pg
    vg deconstruct -P 'ref#' -a -u graph.pg | bgzip > variants.vcf.gz
    tabix -p vcf variants.vcf.gz
    project-vcf-to-cs-paf.py --paf untangle.paf --vcf variants.vcf.gz \\
        --out untangle.cs.paf
    (echo "#genomes=$(haplotypes)"; sort -k6,6 -k8,8n untangle.cs.paf) \\
        | bgzip > untangle.cs.paf.gz
    tabix -0 -s6 -b8 -e9 untangle.cs.paf.gz

Naming join: untangle queries are PanSN (`sample01#0#ctgA`); VCF GT-header
samples are stripped to the first PanSN field (`sample01`). The first
'#'-delimited field is the join key.

VCF expectations:
    POS         — 1-based ref position; converted to 0-based block-relative.
    REF / ALT   — vg deconstruct emits one ALT per snarl traversal, comma-sep.
    GT          — haploid integer (0 = ref, 1+ = ALT index) or `.` (missing).
                  Phased pairs (`a|b`) are reduced to the first allele —
                  fine for vg deconstruct which writes one allele per sample
                  per snarl.

Limitations / known gaps:
    * Strand column is graph-internal, not biological. odgi untangle's strand
      column reports whether the haplotype's path traverses graph nodes in
      the same orientation as the target (>50% threshold) — NOT whether the
      haplotype's *sequence* is revcomp of the reference. Both qstart..qend
      and tstart..tend advance forward in either case. vg deconstruct emits
      alleles in reference orientation regardless of graph-traversal
      direction, so the projection is correct for both `+` and `-` blocks.
      True biological inversions are a separate (smaller) signal that this
      pipeline does not currently distinguish.
    * Snarl-on-block-boundary: a snarl spanning two untangle blocks is
      assigned to whichever block contains its reference-anchor position.
      Variants whose anchor falls in block A but whose deletion extends past
      block A's tend have their cs op clipped (counted as `cross_block_clipped`).
    * Overlapping snarls (nested decompositions): if two variants overlap in
      reference space (vg deconstruct -a emits nested calls), the later one
      is skipped to keep the cs string monotonic (counted as `overlap_skipped`).
      For full-fidelity nested-snarl detail ship the VCF as a separate variant
      track — a `cs:Z:` is intrinsically flat.
"""

import argparse
import bisect
import gzip
import sys
from collections import defaultdict


def open_text(path):
    return gzip.open(path, 'rt') if path.endswith('.gz') else open(path)


def _parse_info_af(info_field):
    """Pull AF list out of an INFO field. Returns None if absent."""
    for kv in info_field.split(';'):
        if kv.startswith('AF='):
            try:
                return [float(x) for x in kv[3:].split(',')]
            except ValueError:
                return None
    return None


def _compute_af_from_gts(gts, n_alts):
    """Fallback: compute AF per ALT from GT calls. AF[i] = count(allele==i+1) / total_called."""
    counts = [0] * n_alts
    total = 0
    for gt_list in gts:
        if gt_list is None:
            continue
        for a in gt_list:
            if a is None:
                continue
            total += 1
            if 0 < a <= n_alts:
                counts[a - 1] += 1
    if total == 0:
        return [0.0] * n_alts
    return [c / total for c in counts]


def parse_vcf(vcf_path):
    """Returns (samples, variants): variants is a list of
    (chrom, pos0, ref, alts, gt_per_sample, af_per_alt) where gt_per_sample[i]
    is the list of allele indices for sample i (length 1 for haploid, 2 for
    diploid, None for missing) and af_per_alt[j] is the allele frequency of
    ALT j (taken from INFO/AF or recomputed from GTs)."""
    variants = []
    samples = []
    with open_text(vcf_path) as fh:
        for line in fh:
            if line.startswith('##'):
                continue
            if line.startswith('#CHROM'):
                samples = line.rstrip('\n').split('\t')[9:]
                continue
            f = line.rstrip('\n').split('\t')
            chrom, pos, _id, ref, alt, _qual, _flt, info = f[:8]
            pos = int(pos) - 1
            alts = alt.split(',')
            gts = []
            for cell in f[9:]:
                cell = cell.split(':', 1)[0]
                if cell in ('.', ''):
                    gts.append(None)
                else:
                    parts = cell.replace('|', '/').split('/')
                    parsed = [None if a == '.' else int(a) for a in parts]
                    gts.append(parsed)
            af = _parse_info_af(info)
            if af is None or len(af) != len(alts):
                af = _compute_af_from_gts(gts, len(alts))
            variants.append((chrom, pos, ref, alts, gts, af))
    return samples, variants


def parse_pansn(name):
    """Parse a PanSN query name into (sample, hap_idx) for VCF lookup.

    PanSN: `sample#hap#contig[:start-end]`. `hap` is 1-indexed in the spec
    (hap 1 = first haplotype) but some pipelines use hap 0 for haploid
    references. We map both to GT-index 0 if there's only one allele in the
    sample's GT, else `int(hap) - 1` clamped to a valid index."""
    parts = name.split('#')
    sample = parts[0]
    hap = 0
    if len(parts) >= 2 and parts[1].isdigit():
        hap = max(0, int(parts[1]) - 1)
    return sample, hap


def select_allele(gt_list, hap_idx):
    """Pick the allele index for hap_idx, falling back to allele 0 if the GT
    is shorter than hap_idx (e.g., haploid sample with PanSN hap=1)."""
    if gt_list is None:
        return None
    if hap_idx < len(gt_list):
        return gt_list[hap_idx]
    return gt_list[0]


def variant_to_cs_op(ref, alt):
    """Reduce (REF, ALT) to (anchor, advance, op_string).
    `anchor` ref bases are stripped left-to-right (added to the running match
    counter by the caller). `advance` is how many further ref bases the
    op_string consumes. op_string is the cs encoding for the residue."""
    anchor = 0
    while ref and alt and ref[0] == alt[0]:
        ref = ref[1:]
        alt = alt[1:]
        anchor += 1
    if not ref and not alt:
        return anchor, 0, ''
    if not alt:
        return anchor, len(ref), f'-{ref.lower()}'
    if not ref:
        return anchor, 0, f'+{alt.lower()}'
    if len(ref) == len(alt):
        ops = ''.join(f'*{r.lower()}{a.lower()}' for r, a in zip(ref, alt))
        return anchor, len(ref), ops
    return anchor, len(ref), f'-{ref.lower()}+{alt.lower()}'


def build_cs_for_block(sample_idx, hap_idx, target_name, tstart, tend,
                       by_target, by_target_pos, min_af, stats):
    """`stats` is a dict counter; updated in-place with `overlap_skipped`,
    `cross_block_clipped`, `af_filtered`. by_target_pos is a parallel list of
    just positions for bisect-based start lookup. `min_af` filters out any
    ALT whose allele frequency is below the threshold."""
    pieces = []
    cursor = tstart
    rows = by_target.get(target_name)
    if not rows:
        return f':{tend - tstart}'
    positions = by_target_pos[target_name]
    start_idx = bisect.bisect_left(positions, tstart)
    for i in range(start_idx, len(rows)):
        _chrom, pos, ref, alts, gts, af = rows[i]
        if pos >= tend:
            break
        allele = select_allele(gts[sample_idx], hap_idx)
        if allele is None or allele == 0 or allele - 1 >= len(alts):
            continue
        if min_af > 0.0 and af[allele - 1] < min_af:
            stats['af_filtered'] += 1
            continue
        anchor, advance, op = variant_to_cs_op(ref, alts[allele - 1])
        op_start = pos + anchor
        if op_start < cursor:
            stats['overlap_skipped'] += 1
            continue
        gap = op_start - cursor
        if gap > 0:
            pieces.append(f':{gap}')
        if op:
            pieces.append(op)
        cursor = op_start + advance
        if cursor > tend:
            stats['cross_block_clipped'] += 1
            cursor = tend
    tail = tend - cursor
    if tail > 0:
        pieces.append(f':{tail}')
    if not pieces:
        return f':{tend - tstart}'
    return ''.join(pieces)


def index_variants_by_target(variants):
    by_target = defaultdict(list)
    for v in variants:
        by_target[v[0]].append(v)
    for target in by_target:
        by_target[target].sort(key=lambda v: v[1])
    by_target_pos = {t: [v[1] for v in rows] for t, rows in by_target.items()}
    return by_target, by_target_pos


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--paf', required=True, help='untangle PAF (plain text)')
    ap.add_argument('--vcf', required=True, help='vg deconstruct VCF (.vcf or .vcf.gz)')
    ap.add_argument('--out', required=True, help='output cs-tagged PAF (plain text)')
    ap.add_argument('--min-af', type=float, default=0.0,
                    help='Drop ALTs with allele frequency below this threshold '
                         '(0.0 = keep all; 0.05 = keep variants in >=5%% of '
                         'haplotypes). Reduces visual overload at zoom on '
                         'large pangenomes. Source: VCF INFO/AF if present, '
                         'else recomputed from GT calls.')
    args = ap.parse_args()

    samples, variants = parse_vcf(args.vcf)
    sample_to_idx = {s: i for i, s in enumerate(samples)}
    by_target, by_target_pos = index_variants_by_target(variants)
    sys.stderr.write(f'[project] {len(variants)} variants, {len(samples)} samples, '
                     f'{len(by_target)} target contigs\n')

    stats = {
        'blocks': 0,
        'with_cs': 0,
        'fwd': 0,
        'rev': 0,
        'unmapped_sample': 0,
        'overlap_skipped': 0,
        'cross_block_clipped': 0,
        'af_filtered': 0,
    }
    with open_text(args.paf) as fh, open(args.out, 'w') as out:
        for line in fh:
            if line.startswith('#') or not line.strip():
                out.write(line)
                continue
            f = line.rstrip('\n').split('\t')
            stats['blocks'] += 1
            qname, _qlen, _qs, _qe, strand, tname, _tlen, ts, te = f[:9]
            ts, te = int(ts), int(te)
            sample, hap_idx = parse_pansn(qname)
            if sample not in sample_to_idx:
                stats['unmapped_sample'] += 1
                out.write(line)
                continue
            stats['fwd' if strand == '+' else 'rev'] += 1
            # Project unconditionally. odgi untangle's strand column reflects
            # graph-traversal node-orientation agreement (>50% threshold), not
            # biological revcomp — qstart..qend and tstart..tend both advance
            # forward in either case. vg deconstruct emits alleles in ref
            # orientation regardless of how the haplotype's path traverses the
            # graph, so the projection is correct for both strands.
            cs = build_cs_for_block(sample_to_idx[sample], hap_idx, tname,
                                    ts, te, by_target, by_target_pos,
                                    args.min_af, stats)
            stats['with_cs'] += 1
            f.append(f'cs:Z:{cs}')
            out.write('\t'.join(f) + '\n')
    sys.stderr.write(
        f'[project] {stats["blocks"]} blocks ({stats["fwd"]} fwd / {stats["rev"]} rev), '
        f'{stats["with_cs"]} with cs:, '
        f'{stats["unmapped_sample"]} unmapped, '
        f'{stats["overlap_skipped"]} overlapping snarls dropped, '
        f'{stats["cross_block_clipped"]} cross-block clips, '
        f'{stats["af_filtered"]} AF-filtered (below {args.min_af})\n'
    )


if __name__ == '__main__':
    main()
