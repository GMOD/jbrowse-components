A decoded session goes in `session`, not `defaultSession`, which validates
against a shape you wrote. The hash fragment never reaches the server, so a long
session cannot fail with HTTP 414. Only the session travels: the receiving page
supplies its own `assembly` and `tracks`.
