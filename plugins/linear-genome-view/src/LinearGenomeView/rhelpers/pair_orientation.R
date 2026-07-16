# Classify a read pair's orientation into the IGV FR-library categories
# (LR normal / RL / RR / LL), reproducing JBrowse's getPairOrientation +
# pairDirection. Vectorized over a BAM's flag / position columns. The leftmost
# mate (self_left) is chosen consistently from either read - by position within a
# chromosome, read1-first when positions tie or the mate position is unknown - so
# the two mates of one pair always agree. Returns NA for unpaired reads or
# orientations outside the FR set. self_pos/mate_pos are 1-based leftmost coords.
pair_orientation <- function(flag, self_pos, mate_pos) {
  is_paired <- bitwAnd(flag, 0x1L) != 0
  is_read1  <- bitwAnd(flag, 0x40L) != 0
  self_str  <- ifelse(bitwAnd(flag, 0x10L) != 0, "R", "F")
  mate_str  <- ifelse(bitwAnd(flag, 0x20L) != 0, "R", "F")
  self_num  <- ifelse(is_read1, "1", "2")
  mate_num  <- ifelse(is_read1, "2", "1")
  known     <- !is.na(mate_pos) & mate_pos > 0
  self_left <- ifelse(!known | self_pos == mate_pos, is_read1, self_pos < mate_pos)
  o <- ifelse(self_left,
    paste0(self_str, self_num, mate_str, mate_num),
    paste0(mate_str, mate_num, self_str, self_num))
  fr <- c(F1R2 = "LR", F2R1 = "LR", R1F2 = "RL", R2F1 = "RL",
          R1R2 = "RR", R2R1 = "RR", F1F2 = "LL", F2F1 = "LL")
  ifelse(is_paired, unname(fr[o]), NA_character_)
}
