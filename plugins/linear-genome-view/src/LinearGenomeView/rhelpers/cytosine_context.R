# Whether the cytosine at each read position sits in a given sequence context.
# Mirrors matchesCytosineContext. The pattern is defined on the TEMPLATE - the
# strand the C is on - read 5'->3', so a forward call reads the stored sequence
# as-is while a reverse one reads backwards from the position and complements
# each base, which is the space getModPositions works reverse-strand reads in.
# "H" is the IUPAC A/C/T; "all" constrains only the cytosine itself, which is how
# a view that wants every C regardless of neighbours asks for one.
#
# 's' is the read sequence already split into single characters and 'pos' its
# 1-based positions; returns a logical the same length as 'pos'. Positions whose
# context runs off either end of the read do not match, the same way an
# out-of-range seq[] read is undefined on the JBrowse side.
cytosine_context <- function(s, pos, rev = FALSE, context = "CG") {
  pattern <- switch(context, CG = c("C", "G"), CHG = c("C", "H", "G"),
                    CHH = c("C", "H", "H"), all = "C", c("C", "G"))
  compl <- c(a = "t", t = "a", c = "g", g = "c")
  n <- length(s)
  ok <- rep(TRUE, length(pos))
  for (i in seq_along(pattern)) {
    at <- if (rev) pos - i + 1L else pos + i - 1L
    b <- rep(NA_character_, length(at))
    inb <- !is.na(at) & at >= 1L & at <= n
    b[inb] <- tolower(s[at[inb]])
    if (rev) b <- unname(compl[b])
    exp <- pattern[i]
    ok <- ok & !is.na(b) &
      (if (exp == "H") b %in% c("a", "c", "t") else b == tolower(exp))
  }
  ok
}
