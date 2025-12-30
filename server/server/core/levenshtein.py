from typing import Literal

OperationCode = Literal["~", "-", "+"]
Operation = tuple[OperationCode, int, int]


def levenshtein(s1: list[str], s2: list[str]) -> tuple[list[str], list[str], list[Operation]]:
    """
    Computes the Levenshtein distance for two sequences of strings.
    Returns the aligned sequences with gaps filled with empty strings,
    and a list of edit operations as tuples of `(operation, i, j)` where:
    - operation is `~`, `-`, or `+`
    - `i` is the index in `s1`
    - `j` is the index in `s2`
    """

    m, n = len(s1), len(s2)

    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j - 1] + cost,  # substitution
                dp[i - 1][j] + 1,  # deletion
                dp[i][j - 1] + 1,  # insertion
            )

    as1 = []
    as2 = []
    operations = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            if dp[i][j] == dp[i - 1][j - 1] + cost:
                as1.append(s1[i - 1])
                as2.append(s2[j - 1])
                if cost == 1:  # substitution/replace
                    operations.append(("~", i - 1, j - 1))
                i -= 1
                j -= 1
                continue
        if j > 0 and dp[i][j] == dp[i][j - 1] + 1:
            as1.append("")
            as2.append(s2[j - 1])
            operations.append(("+", i, j - 1))
            j -= 1
            continue
        if i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            as1.append(s1[i - 1])
            as2.append("")
            operations.append(("-", i - 1, j))
            i -= 1
            continue

    as1.reverse()
    as2.reverse()
    operations.reverse()

    assert len(as1) == len(as2), "aligned sequences must have the same length"

    return as1, as2, operations
