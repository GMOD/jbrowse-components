#!/usr/bin/env python3
"""Project a `vg deconstruct -a -u` VCF onto an `odgi untangle` PAF, emitting
a cs:-tagged PAF that the JBrowse MultiLGVSyntenyDisplay renders directly.

IMPORTANT — read before using:
    If your only goal is "show N haplotypes aligned to a reference with
    per-base SNPs/indels," **bigMaf / MAF is the standard, simpler, more
    correct format** and JBrowse already supports it (`plugins/maf/`). This
    script exists because (a) the impg+tracepoints pivot needs PAF, and
    (b) untangle macro-blocks are useful at zoom-out — see
    `agent-docs/GRAPH_PLAN.md` "Honest comparison with MAF/bigMaf".

    Concrete cs:Z: limits this script CANNOT overcome:
      - No RC operator → inversions cannot be encoded per-base. Big
        len(REF)==len(ALT) records with ALT == revcomp(REF) are SKIPPED
        (--large-substitution-threshold, default 20 bp); per-base detail
        inside an inversion is *hidden*, not *shown*. MAF would show it.
      - cs:Z: is a flat linear walk → nested snarls flattened, overlapping
        records dropped to keep the string monotonic.
      - cs:Z: has no node-ID column → graph-awareness lost at the renderer.

Projects `vg deconstruct -a -u` AP/AT positioned variants onto each
untangle block's target window. The graph's own per-base decomposition;
no re-alignment; preserves snarl-aware variant calls. Subject to the
cs:Z:-format limits listed above.

A predecessor `enrich-untangle-paf.py` (removed 2026-05-15) ran
`minimap2 --cs` per block on linearized PAF subseqs. That approach
silently produces alignment soup for untangle blocks whose path
coordinates merge across bubbles — qsub and tsub linearize different
node walks, so they don't sequence-correspond even at id:f:99+ blocks.
The volvox debugging session that surfaced this is in git history.
**Do not reintroduce sequence-realignment as a cs derivation path for
untangle output.**

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
      True biological inversions still surface as `-` strand AND as a big
      len(REF)==len(ALT) record (next bullet).
    * Inversions: vg deconstruct flattens an inversion bubble into one
      record where len(REF)==len(ALT) and ALT == revcomp(REF). cs:Z: has no
      RC operator, so per-base projection would paint thousands of bogus
      SNPs. Records at or above --large-substitution-threshold (default 20)
      are SKIPPED — block-level `-` strand on the PAF is the only signal
      for them. This is a real loss of fidelity vs MAF. Verified on volvox
      ctgA:3957 (4396 bp record, ALT bit-identical to rc(REF)).
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
import re
import sys
from collections import defaultdict


# Match parsePanSN's subwalk-suffix handling: `name:start-end` → `name`, offset.
_RE_SUBWALK = re.compile(r':(-?\d+)-(-?\d+)$')


def strip_subwalk(target_name):
    """Returns (stripped_name, offset). offset is added to local tstart/tend
    to get the position in the unified parent contig — needed when vg deconstruct
    unifies fragmented PanSN paths (CHM13#0#chr20:100864-26386516,
    CHM13#0#chr20:29927279-30227020, ...) into one VCF chrom (CHM13#0#chr20)."""
    m = _RE_SUBWALK.search(target_name)
    if not m:
        return target_name, 0
    return target_name[:m.start()], int(m.group(1))


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


_COMP = str.maketrans('ACGTNacgtn', 'TGCANtgcan')


def variant_to_cs_op(ref, alt, large_threshold):
    """Reduce (REF, ALT) to (anchor, advance, op_string).
    `anchor` ref bases are stripped left-to-right (added to the running match
    counter by the caller). `advance` is how many further ref bases the
    op_string consumes. op_string is the cs encoding for the residue.

    Returns op=None when the record represents a large equal-length
    substitution (typically an inversion or a complex bubble that vg
    deconstruct flattened): cs:Z: cannot encode "the next N bp are reverse-
    complemented" and decomposing it into N per-base SNPs is misleading. The
    block-level strand column already conveys "this segment differs in
    orientation/structure"; we skip the per-base projection in that case so
    the renderer stays honest at the per-base zoom too."""
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
        if len(ref) >= large_threshold:
            return anchor, len(ref), None
        ops = ''.join(f'*{r.lower()}{a.lower()}' for r, a in zip(ref, alt))
        return anchor, len(ref), ops
    return anchor, len(ref), f'-{ref.lower()}+{alt.lower()}'


def build_cs_for_block(sample_idx, hap_idx, target_name, tstart, tend,
                       by_target, by_target_pos, min_af, large_threshold, stats):
    """`stats` is a dict counter; updated in-place with `overlap_skipped`,
    `cross_block_clipped`, `af_filtered`, `large_skipped`. by_target_pos is a
    parallel list of just positions for bisect-based start lookup. `min_af`
    filters out any ALT whose allele frequency is below the threshold.
    `large_threshold` collapses big equal-length substitutions to plain
    matches (see variant_to_cs_op)."""
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
        anchor, advance, op = variant_to_cs_op(ref, alts[allele - 1], large_threshold)
        op_start = pos + anchor
        if op_start < cursor:
            stats['overlap_skipped'] += 1
            continue
        gap = op_start - cursor
        if gap > 0:
            pieces.append(f':{gap}')
        if op is None:
            # Skipped (large equal-length, see variant_to_cs_op). Emit a
            # match run covering the skipped span so the renderer's refPos
            # walks past it — without this, every subsequent variant's
            # position in `mismatches[]` is off by `advance`. The block-
            # level `-` strand on the PAF is the real signal; cs:Z: just
            # has to stay positionally consistent across the block.
            stats['large_skipped'] += 1
            new_cursor = op_start + advance
            if new_cursor > tend:
                stats['cross_block_clipped'] += 1
                new_cursor = tend
            span = new_cursor - op_start
            if span > 0:
                pieces.append(f':{span}')
            cursor = new_cursor
            continue
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
    ap.add_argument('--large-substitution-threshold', type=int, default=20,
                    help='Equal-length REF/ALT records this big or bigger are '
                         'left as plain matches in cs (block-level strand '
                         'already conveys the structural event). vg '
                         'deconstruct often flattens an inversion-bubble into '
                         'one big len(REF)==len(ALT) record; decomposing it '
                         'into per-base SNPs looks like thousands of point '
                         'mutations when it is really one event. Default 20.')
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
        'large_skipped': 0,
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
            #
            # Handle subwalk suffix: PAF target names like
            # `CHM13#0#chr20:100864-26386516` map to VCF chrom
            # `CHM13#0#chr20` with positions offset by 100864 (vg deconstruct
            # unifies fragmented PanSN paths into one virtual contig).
            tname_stripped, tname_offset = strip_subwalk(tname)
            lookup_name = (tname_stripped if tname_stripped in by_target
                           else tname)
            lookup_offset = tname_offset if lookup_name == tname_stripped else 0
            cs = build_cs_for_block(sample_to_idx[sample], hap_idx,
                                    lookup_name,
                                    ts + lookup_offset, te + lookup_offset,
                                    by_target, by_target_pos,
                                    args.min_af,
                                    args.large_substitution_threshold,
                                    stats)
            stats['with_cs'] += 1
            f.append(f'cs:Z:{cs}')
            out.write('\t'.join(f) + '\n')
    sys.stderr.write(
        f'[project] {stats["blocks"]} blocks ({stats["fwd"]} fwd / {stats["rev"]} rev), '
        f'{stats["with_cs"]} with cs:, '
        f'{stats["unmapped_sample"]} unmapped, '
        f'{stats["overlap_skipped"]} overlapping snarls dropped, '
        f'{stats["cross_block_clipped"]} cross-block clips, '
        f'{stats["af_filtered"]} AF-filtered (below {args.min_af}), '
        f'{stats["large_skipped"]} large-substitution skipped '
        f'(>= {args.large_substitution_threshold} bp equal-length)\n'
    )


if __name__ == '__main__':
    main()
