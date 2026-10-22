"""One judge prompt, and the probability of the next token.

The model is not asked to type a number. Small models are bad at that, and a
typed "0.70" is not a probability. We read the next-token distribution and
keep only the Yes and No tokens:

    P(fits) = P(Yes tokens) / (P(Yes tokens) + P(No tokens))

P is the full-vocabulary softmax on a local model. An OpenAI-compatible
server usually returns only the top logprobs, so that path uses the same
formula on the tokens the server sent back. If Yes and No are both missing
from that list, the run stops instead of inventing a score.

Default backend is local. Set JUDGE_BACKEND=openai to use the other one.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from dataset import RULES

PROMPT_VERSION = "2"
DEFAULT_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"
# Pinned so a later rerun scores the same checkpoint this walkthrough used.
DEFAULT_REVISION = "989aa7980e4cf806f80c7fef2b1adb7bc71aa306"

SYSTEM = (
    "You are a retail search judge. Answer Yes only when the product is the same item "
    "the query asks for and every requirement named in the query is met. "
    "A different product, or the right product with a missed requirement, is No. "
    "Use only the rules and the card. Answer with a single word: Yes or No."
)

YES_WORDS = ("Yes", "yes", "YES")
NO_WORDS = ("No", "no", "NO")


def user_message(row):
    return (
        f"Rules:\n{RULES}\n\n"
        f"Query: {row['query']}\n"
        f"Product: {row['title']}\n"
        f"Details: {row['details']}\n\n"
        "Does this product fit the query?\n"
        "Yes or No:"
    )


def messages(row):
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_message(row)},
    ]


def single_token_ids(tokenizer, words):
    """Map surface forms that are exactly one token to that token id.

    A leading space is included because some tokenizers only have " Yes"
    as its own token. Forms that split into several tokens are ignored, so
    we never add up a prefix.
    """
    found = {}
    for word in words:
        for variant in (word, " " + word):
            ids = tokenizer.encode(variant, add_special_tokens=False)
            if len(ids) == 1:
                found[int(ids[0])] = variant
    return found


def mass_from_pairs(pairs):
    """pairs are (token_text, probability), already in probability space."""
    yes_mass = 0.0
    no_mass = 0.0
    top = []
    for token, probability in pairs:
        top.append({"token": token, "prob": float(probability)})
        key = token.strip().strip(".:").lower()
        if key == "yes":
            yes_mass += float(probability)
        elif key == "no":
            no_mass += float(probability)
    return yes_mass, no_mass, top


def score_from_mass(yes_mass, no_mass):
    total = yes_mass + no_mass
    if total <= 0:
        return None
    return yes_mass / total


def local_model_settings():
    model_id = os.environ.get("JUDGE_MODEL", DEFAULT_MODEL)
    revision = os.environ.get("JUDGE_REVISION")
    if revision is None and model_id == DEFAULT_MODEL:
        revision = DEFAULT_REVISION
    batch_size = int(os.environ.get("JUDGE_BATCH", "4"))
    return model_id, revision, batch_size


def score_rows_local(rows, progress=None):
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    model_id, revision, batch_size = local_model_settings()
    tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision)
    yes_ids = single_token_ids(tokenizer, YES_WORDS)
    no_ids = single_token_ids(tokenizer, NO_WORDS)
    if not yes_ids or not no_ids:
        raise RuntimeError(
            "This tokenizer has no single token for Yes or No. "
            f"yes={yes_ids} no={no_ids}"
        )
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    # Left padding keeps the last position equal to the last real token.
    tokenizer.padding_side = "left"

    prompts = [
        tokenizer.apply_chat_template(messages(row), tokenize=False, add_generation_prompt=True)
        for row in rows
    ]
    token_lengths = [len(tokenizer.encode(prompt, add_special_tokens=False)) for prompt in prompts]
    if max(token_lengths) > 768:
        raise RuntimeError(
            f"A prompt is {max(token_lengths)} tokens. Raise the limit in judge.py before scoring."
        )
    torch.set_num_threads(int(os.environ.get("JUDGE_THREADS", "4")))
    # bfloat16 keeps a 1.5B model near 3 GB. The score is still the softmax
    # over the next-token logits, not a number the model was asked to type.
    dtype_name = os.environ.get("JUDGE_DTYPE", "bfloat16")
    dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}[dtype_name]
    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        revision=revision,
        torch_dtype=dtype,
    )
    model.eval()

    scored = []
    yes_index = list(yes_ids)
    no_index = list(no_ids)
    with torch.inference_mode():
        for start in range(0, len(rows), batch_size):
            batch_rows = rows[start : start + batch_size]
            batch_prompts = prompts[start : start + batch_size]
            encoded = tokenizer(
                batch_prompts,
                return_tensors="pt",
                padding=True,
                truncation=False,
            )
            logits = model(**encoded).logits[:, -1, :]
            probabilities = torch.softmax(logits, dim=-1)
            top_prob, top_id = torch.topk(probabilities, k=8, dim=-1)
            for index, row in enumerate(batch_rows):
                probs = probabilities[index]
                yes_mass = float(probs[yes_index].sum())
                no_mass = float(probs[no_index].sum())
                p_fit = score_from_mass(yes_mass, no_mass)
                top = []
                for token_id, token_prob in zip(top_id[index].tolist(), top_prob[index].tolist()):
                    top.append(
                        {
                            "token": tokenizer.decode([token_id]),
                            "prob": float(token_prob),
                        }
                    )
                if p_fit is None:
                    raise RuntimeError(
                        f"No Yes/No probability for {row['id']}. Top tokens: {top}"
                    )
                scored.append(
                    {
                        "id": row["id"],
                        "p_fit": p_fit,
                        "yes_mass": yes_mass,
                        "no_mass": no_mass,
                        "yes_no_mass": yes_mass + no_mass,
                        "top": top,
                    }
                )
            if progress:
                progress(min(start + batch_size, len(rows)), len(rows))

    meta = {
        "backend": "local",
        "model": model_id,
        "revision": revision,
        "dtype": dtype_name,
        "prompt_version": PROMPT_VERSION,
        "yes_tokens": {str(token_id): text for token_id, text in yes_ids.items()},
        "no_tokens": {str(token_id): text for token_id, text in no_ids.items()},
        "templated_example": prompts[0] if prompts else "",
        "prompt_tokens_example": token_lengths[0] if token_lengths else 0,
        "prompt_tokens_max": max(token_lengths) if token_lengths else 0,
    }
    return meta, scored


def score_rows_openai(rows, progress=None):
    base = os.environ.get("OPENAI_BASE_URL", "").rstrip("/")
    model_id = os.environ.get("OPENAI_MODEL", "")
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not base or not model_id:
        raise RuntimeError(
            "JUDGE_BACKEND=openai needs OPENAI_BASE_URL and OPENAI_MODEL. "
            "Example: OPENAI_BASE_URL=http://127.0.0.1:8080/v1 OPENAI_MODEL=my-model"
        )
    url = base + "/chat/completions"
    scored = []
    for index, row in enumerate(rows, start=1):
        body = {
            "model": model_id,
            "temperature": 0,
            "max_tokens": 1,
            "logprobs": True,
            "top_logprobs": 10,
            "messages": messages(row),
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        if api_key:
            request.add_header("Authorization", f"Bearer {api_key}")
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Judge API returned {error.code}: {detail}") from error
        scored.append(_score_openai_choice(row["id"], payload))
        if progress:
            progress(index, len(rows))
    meta = {
        "backend": "openai",
        "model": model_id,
        "revision": None,
        "base_url": base,
        "prompt_version": PROMPT_VERSION,
        "yes_tokens": {},
        "no_tokens": {},
        "templated_example": "",
    }
    return meta, scored


def _score_openai_choice(row_id, payload):
    import math

    try:
        content = payload["choices"][0]["logprobs"]["content"][0]
        listed = content["top_logprobs"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError(
            "The server did not return next-token logprobs. "
            "This walkthrough needs them; a typed yes or no is not a score. "
            f"Response keys: {list(payload) if isinstance(payload, dict) else type(payload)}"
        ) from error
    pairs = [(item["token"], math.exp(item["logprob"])) for item in listed]
    yes_mass, no_mass, top = mass_from_pairs(pairs)
    p_fit = score_from_mass(yes_mass, no_mass)
    if p_fit is None:
        raise RuntimeError(
            f"No Yes or No token in the top logprobs for {row_id}. Top tokens: {top}. "
            "Raise top_logprobs, or use a model that answers Yes or No."
        )
    return {
        "id": row_id,
        "p_fit": p_fit,
        "yes_mass": yes_mass,
        "no_mass": no_mass,
        "yes_no_mass": yes_mass + no_mass,
        "top": top,
    }


def score_rows(rows, progress=None):
    backend = os.environ.get("JUDGE_BACKEND", "local").strip().lower()
    if backend == "local":
        return score_rows_local(rows, progress=progress)
    if backend == "openai":
        return score_rows_openai(rows, progress=progress)
    raise RuntimeError("JUDGE_BACKEND must be local or openai")
