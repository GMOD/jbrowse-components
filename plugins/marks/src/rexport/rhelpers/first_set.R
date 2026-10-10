# Elementwise, the first of the vectors with a value: what a jexl `a || b`
# answers.
first_set <- function(...) {
  Reduce(function(a, b) ifelse(is.na(a) | a == "", b, a), list(...))
}
