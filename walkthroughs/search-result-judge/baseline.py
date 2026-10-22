"""Keyword overlap, the non-LLM comparison.

fit_score is the share of query tokens that show up in the title or the
details. It does not know that EVOO means extra virgin olive oil, or that
64 fl oz is a half gallon. Those equivalences are in the judge prompt.

Apostrophes are removed so "men's" and "mens" match. Digits stay, because
"size 10" and "8 pack" are part of the query.
"""

from __future__ import annotations

import re


def tokens(text):
    text = text.lower().replace("'", "").replace("’", "")
    return re.findall(r"[a-z0-9]+", text)


def fit_score(query, title, details):
    query_tokens = tokens(query)
    if not query_tokens:
        return 0.0
    card = set(tokens(f"{title} {details}"))
    hits = sum(1 for token in query_tokens if token in card)
    return hits / len(query_tokens)
