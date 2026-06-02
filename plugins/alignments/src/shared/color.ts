export const fillColor = {
  color_fwd_strand_not_proper: '#ECC8C8',
  color_rev_strand_not_proper: '#BEBED8',
  /** #color alignments-strand | Forward strand | Read maps to the forward strand */
  color_fwd_strand: '#EC8B8B',
  /** #color alignments-strand | Reverse strand | Read maps to the reverse strand */
  color_rev_strand: '#8F8FD8',
  color_fwd_missing_mate: '#D11919',
  color_rev_missing_mate: '#1919D1',
  color_fwd_diff_chr: '#000',
  color_rev_diff_chr: '#969696',
  /** #color alignments-pair-orientation | LR (→ ←, normal proper pair) | Concordant */
  color_pair_lr: 'lightgrey',
  /** #color alignments-pair-orientation | RL (← →, mates point away from each other) | Abnormal orientation */
  color_pair_rl: 'teal',
  /** #color alignments-pair-orientation | LL (→ →, both mates forward strand) | Abnormal orientation */
  color_pair_ll: 'green',
  /** #color alignments-pair-orientation | RR (← ←, both mates reverse strand) | Abnormal orientation */
  color_pair_rr: '#3a3a9d',
  color_nostrand: '#c8c8c8',
  color_interchrom: 'purple',
  color_longinsert: 'red',
  color_shortinsert: 'pink',
  color_unmapped_mate: '#8B4513',
  color_unknown: 'grey',
  // Long-read split alignment orientation colors
  color_longread_rev_fwd: 'navy',
  color_longread_inv: '#3a3a9d',
  // Supplementary/split alignment color (light orange)
  color_supplementary: '#f0b878',
  // Samplot-style SV palette (FR→DEL-normal, RF→DUP, FF/RR→INV, interchrom→BND)
  color_samplot_del: 'black',
  color_samplot_dup: 'red',
  color_samplot_inv: 'blue',
  color_samplot_bnd: 'purple',
}
