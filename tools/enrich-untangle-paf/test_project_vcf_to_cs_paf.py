"""Unit tests for project-vcf-to-cs-paf.py.

Run from this directory: `python3 -m unittest test_project_vcf_to_cs_paf`.

Stdlib-only (no pytest required). Covers the cases that have broken the
projector in production at least once:

  * Inversion-as-SNP-soup: a large len(REF)==len(ALT) record where ALT is
    revcomp(REF). cs:Z: has no RC operator, so per-base decomposition is
    bogus. `--large-substitution-threshold` (default 20) must skip these.
    Verified live on volvox ctgA:3957 (4396 bp record); see
    [[inversion-as-snp-soup]] in memory.
  * Overlap drop: vg deconstruct -a emits nested snarls; cs is intrinsically
    flat, so the later record must drop.
  * Cross-block clip: a variant whose anchor falls in block A but whose
    deletion extends past block A's tend must clip.
  * AF filter: --min-af X drops ALTs with frequency below X.
  * Small SNP/indel: standard cases must still produce the right cs ops.
"""

import importlib.util
import os
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SPEC = importlib.util.spec_from_file_location(
    'project_vcf_to_cs_paf',
    os.path.join(_HERE, 'project-vcf-to-cs-paf.py'))
proj = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(proj)


class VariantToCsOpTests(unittest.TestCase):
    """Single-record reduction. Anchor strip + op encoding."""

    def test_snp(self):
        self.assertEqual(proj.variant_to_cs_op('A', 'T', 20), (0, 1, '*at'))

    def test_snp_with_anchor(self):
        # First base matches (anchor=1), second differs.
        self.assertEqual(proj.variant_to_cs_op('AT', 'AG', 20), (1, 1, '*tg'))

    def test_deletion(self):
        # REF=ACG, ALT=A → 2 bp deletion. Anchor=1 (the 'A').
        self.assertEqual(proj.variant_to_cs_op('ACG', 'A', 20), (1, 2, '-cg'))

    def test_insertion(self):
        # REF=A, ALT=ACG → 2 bp insertion. Anchor=1.
        self.assertEqual(proj.variant_to_cs_op('A', 'ACG', 20),
                         (1, 0, '+cg'))

    def test_small_equal_length_substitution_decomposes(self):
        # 5 bp REF/ALT, both differ entirely. Below threshold (20). Decompose.
        anchor, advance, op = proj.variant_to_cs_op(
            'AAAAA', 'TTTTT', large_threshold=20)
        self.assertEqual(anchor, 0)
        self.assertEqual(advance, 5)
        self.assertEqual(op, '*at*at*at*at*at')

    def test_large_equal_length_substitution_skipped(self):
        # 25 bp REF/ALT — at/over threshold. Must skip (op=None) — caller
        # advances cursor but writes nothing. This is the inversion-soup fix.
        ref = 'A' * 25
        alt = 'T' * 25
        anchor, advance, op = proj.variant_to_cs_op(ref, alt,
                                                    large_threshold=20)
        self.assertEqual(anchor, 0)
        self.assertEqual(advance, 25)
        self.assertIsNone(op)

    def test_threshold_boundary_inclusive(self):
        # Records of *exactly* threshold size are skipped (>= threshold).
        ref = 'A' * 20
        alt = 'T' * 20
        _, _, op = proj.variant_to_cs_op(ref, alt, large_threshold=20)
        self.assertIsNone(op)

    def test_inversion_real_case_skipped(self):
        # Volvox-style: large equal-length REF/ALT (an inversion bubble
        # vg deconstruct flattens). Without the skip this would emit
        # ~100 bogus *xy ops. Equal length is what matters here.
        ref = 'A' * 100
        alt = 'T' * 100
        _, _, op = proj.variant_to_cs_op(ref, alt, large_threshold=20)
        self.assertIsNone(op)


def _make_stats():
    return {
        'blocks': 0, 'with_cs': 0, 'fwd': 0, 'rev': 0,
        'unmapped_sample': 0, 'overlap_skipped': 0,
        'cross_block_clipped': 0, 'af_filtered': 0, 'large_skipped': 0,
    }


def _index_variants(rows):
    """rows: list of (chrom, pos0, ref, alts, gts, af). Mirrors parse_vcf
    output shape. Returns (by_target, by_target_pos)."""
    by_target, by_target_pos = proj.index_variants_by_target(rows)
    return by_target, by_target_pos


class BuildCsForBlockTests(unittest.TestCase):
    """End-to-end cs construction across a tstart..tend window."""

    def test_single_snp_in_window(self):
        # One SNP at tpos=10, sample carries ALT. Block 0..20.
        rows = [('chr1', 10, 'A', ['T'], [[1]], [1.0])]
        by_t, by_p = _index_variants(rows)
        stats = _make_stats()
        cs = proj.build_cs_for_block(0, 0, 'chr1', 0, 20, by_t, by_p,
                                     0.0, 20, stats)
        # 10 match + *at + 9 match
        self.assertEqual(cs, ':10*at:9')

    def test_inversion_record_skipped_no_snp_soup(self):
        # Large equal-length record. cs:Z: emits matches across the entire
        # span — `:10` prefix + `:30` for the skipped inversion + `:10`
        # tail. The block-level strand carries the actual "inverted" signal;
        # cs just stays positionally consistent so subsequent variants land
        # at the right refPos in the renderer.
        ref = 'A' * 30
        alt = 'T' * 30
        rows = [('chr1', 10, ref, [alt], [[1]], [1.0])]
        by_t, by_p = _index_variants(rows)
        stats = _make_stats()
        cs = proj.build_cs_for_block(0, 0, 'chr1', 0, 50, by_t, by_p,
                                     0.0, 20, stats)
        self.assertEqual(cs, ':10:30:10')
        self.assertEqual(stats['large_skipped'], 1)

    def test_variant_after_skipped_record_positioned_correctly(self):
        # Regression: a SNP after a skipped record must report its
        # position relative to the block start, not relative to where the
        # cursor was before the skip.
        rows = [
            ('chr1', 5, 'A' * 30, ['T' * 30], [[1]], [1.0]),  # skipped
            ('chr1', 45, 'G', ['C'], [[1]], [1.0]),           # real SNP
        ]
        by_t, by_p = _index_variants(rows)
        stats = _make_stats()
        cs = proj.build_cs_for_block(0, 0, 'chr1', 0, 60, by_t, by_p,
                                     0.0, 20, stats)
        # :5 prefix + :30 skipped + :10 gap to SNP + *gc + :14 tail
        self.assertEqual(cs, ':5:30:10*gc:14')

    def test_overlap_drop(self):
        # Two records, overlapping ref ranges. Second must drop.
        rows = [
            ('chr1', 10, 'ACGT', ['A'], [[1]], [1.0]),   # del at 10..14
            ('chr1', 12, 'G', ['T'], [[1]], [1.0]),      # would land inside
        ]
        by_t, by_p = _index_variants(rows)
        stats = _make_stats()
        proj.build_cs_for_block(0, 0, 'chr1', 0, 30, by_t, by_p,
                                0.0, 20, stats)
        self.assertEqual(stats['overlap_skipped'], 1)

    def test_cross_block_clip(self):
        # 5 bp deletion at pos 18 in a block ending at 20. Clips at 20.
        rows = [('chr1', 18, 'ACGTAC', ['A'], [[1]], [1.0])]
        by_t, by_p = _index_variants(rows)
        stats = _make_stats()
        cs = proj.build_cs_for_block(0, 0, 'chr1', 0, 20, by_t, by_p,
                                     0.0, 20, stats)
        self.assertEqual(stats['cross_block_clipped'], 1)
        # cursor was clamped to tend=20, so no trailing ':N'
        self.assertEqual(cs, ':19-cgtac')

    def test_af_filter(self):
        rows = [
            ('chr1', 10, 'A', ['T'], [[1]], [0.01]),  # below threshold
            ('chr1', 15, 'A', ['T'], [[1]], [0.5]),   # above threshold
        ]
        by_t, by_p = _index_variants(rows)
        stats = _make_stats()
        cs = proj.build_cs_for_block(0, 0, 'chr1', 0, 20, by_t, by_p,
                                     0.05, 20, stats)
        self.assertEqual(stats['af_filtered'], 1)
        # Only the AF=0.5 record passes — match up to 15, *at, then 4 match.
        self.assertEqual(cs, ':15*at:4')

    def test_no_variants_pure_match(self):
        # Empty block — pure :N match string.
        by_t, by_p = _index_variants([])
        stats = _make_stats()
        cs = proj.build_cs_for_block(0, 0, 'chr1', 100, 200, by_t, by_p,
                                     0.0, 20, stats)
        self.assertEqual(cs, ':100')


class PanSNTests(unittest.TestCase):

    def test_three_part_pansn(self):
        self.assertEqual(proj.parse_pansn('HG00438#1#chr20'), ('HG00438', 0))

    def test_hap_index_zero_based(self):
        # hap=1 → 0; hap=2 → 1
        self.assertEqual(proj.parse_pansn('S#1#c'), ('S', 0))
        self.assertEqual(proj.parse_pansn('S#2#c'), ('S', 1))

    def test_two_part_pansn(self):
        self.assertEqual(proj.parse_pansn('sample01#0'), ('sample01', 0))

    def test_bare_name(self):
        self.assertEqual(proj.parse_pansn('chr20'), ('chr20', 0))


if __name__ == '__main__':
    unittest.main()
