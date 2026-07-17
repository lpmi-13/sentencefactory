#!/usr/bin/env python3
"""Build Sentence Factory's static exercise corpus from UD English PUD."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from dataclasses import dataclass, replace
from pathlib import Path

SOURCE_VERSION = "2.18"
SOURCE_URL = (
    "https://raw.githubusercontent.com/UniversalDependencies/UD_English-PUD/"
    "r2.18/en_pud-ud-test.conllu"
)
SOURCE_SHA256 = "c80584f2bc2b31d5bada78a1136f9feec7ac49e5e18898db02dea434b5b8f0aa"
SOURCE_PAGE = "https://universaldependencies.org/treebanks/en_pud/index.html"
LICENSE_NAME = "CC BY-SA 3.0"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/3.0/"

FEATURES = {
    "simple_past": "VBD",
    "present_participle": "VBG",
    "past_participle": "VBN",
}
MAX_EXERCISES_PER_FEATURE = 36
MIN_EXERCISES_PER_FEATURE = 24
MIN_WORDS = 6
MAX_WORDS = 20

TOKEN_PATTERN = re.compile(r"^[A-Za-z]+(?:['’-][A-Za-z]+)*$")
UNSUITABLE_TEXT = re.compile(
    r"(?:https?://|www\.|\b(?:abuse|attack|bomb|casualt(?:y|ies)|crime|dead|death|"
    r"died|drugs?|guns?|jail|kill(?:ed|ing)?|murder|police|porn|rape|sexual?|shoot(?:ing)?|"
    r"suicide|terror(?:ism|ist)?|victim|violence|war|weapons?)\b)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Token:
    form: str
    lemma: str
    upos: str
    xpos: str
    features: str
    space_after: bool


@dataclass(frozen=True)
class Sentence:
    sentence_id: str
    text: str
    tokens: tuple[Token, ...]


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        help="Read an existing CoNLL-U file instead of downloading the pinned release.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/data/corpus.generated.json"),
        help="Generated JSON destination.",
    )
    return parser.parse_args()


def load_source(input_path: Path | None) -> bytes:
    if input_path is not None:
        payload = input_path.read_bytes()
    else:
        request = urllib.request.Request(
            SOURCE_URL,
            headers={"User-Agent": "sentencefactory-corpus-builder/1.0"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()

    digest = hashlib.sha256(payload).hexdigest()
    if digest != SOURCE_SHA256:
        raise RuntimeError(
            f"UD source checksum mismatch: expected {SOURCE_SHA256}, received {digest}."
        )
    return payload


def parse_sentences(payload: bytes) -> list[Sentence]:
    sentences: list[Sentence] = []
    text = payload.decode("utf-8")

    for block in re.split(r"\n\s*\n", text.strip()):
        sentence_id = ""
        source_text = ""
        tokens: list[Token] = []

        for line in block.splitlines():
            if line.startswith("# sent_id = "):
                sentence_id = line.removeprefix("# sent_id = ").strip()
                continue
            if line.startswith("# text = "):
                source_text = line.removeprefix("# text = ").strip()
                continue
            if line.startswith("#") or not line:
                continue

            columns = line.split("\t")
            if len(columns) != 10 or not columns[0].isdigit():
                continue

            tokens.append(
                Token(
                    form=columns[1],
                    lemma=columns[2],
                    upos=columns[3],
                    xpos=columns[4],
                    features=columns[5],
                    space_after="SpaceAfter=No" not in columns[9].split("|"),
                )
            )

        if sentence_id and source_text and tokens:
            normalized_tokens: list[Token] = []
            for token in tokens:
                if token.form.startswith(("'", "’")) and normalized_tokens:
                    normalized_tokens[-1] = replace(normalized_tokens[-1], space_after=False)
                normalized_tokens.append(token)
            sentences.append(Sentence(sentence_id, source_text, tuple(normalized_tokens)))

    return sentences


def usable_sentence(sentence: Sentence) -> bool:
    lexical_word_count = sum(
        token.upos not in {"PUNCT", "SYM"} for token in sentence.tokens
    )
    if not MIN_WORDS <= lexical_word_count <= MAX_WORDS:
        return False
    if UNSUITABLE_TEXT.search(sentence.text):
        return False
    if any(
        "Typo=Yes" in token.features or "Foreign=Yes" in token.features
        for token in sentence.tokens
    ):
        return False
    return True


def target_indices(sentence: Sentence, xpos: str) -> list[int]:
    return [
        index
        for index, token in enumerate(sentence.tokens)
        if token.upos == "VERB"
        and token.xpos == xpos
        and token.form.casefold() != token.lemma.casefold()
        and token.lemma != "_"
        and TOKEN_PATTERN.fullmatch(token.form)
        and TOKEN_PATTERN.fullmatch(token.lemma)
    ]


def quality_key(sentence: Sentence, target_index: int) -> tuple[object, ...]:
    token = sentence.tokens[target_index]
    lexical_word_count = sum(
        item.upos not in {"PUNCT", "SYM"} for item in sentence.tokens
    )
    proper_nouns = sum(item.upos == "PROPN" for item in sentence.tokens)
    return (
        0 if sentence.sentence_id.startswith("w") else 1,
        int(any(character.isdigit() for character in sentence.text)),
        int(any(character in sentence.text for character in "\"“”")),
        proper_nouns,
        abs(12 - lexical_word_count),
        abs(6 - len(token.lemma)),
        sentence.sentence_id,
    )


def capitalize_like(form: str, lemma: str) -> str:
    if form.isupper():
        return lemma.upper()
    if form[:1].isupper():
        return lemma[:1].upper() + lemma[1:]
    return lemma


def exercise_record(
    sentence: Sentence, feature: str, target_index: int
) -> dict[str, object]:
    target = sentence.tokens[target_index]
    return {
        "id": f"{sentence.sentence_id}:{target_index + 1}:{feature}",
        "feature": feature,
        "sourceText": sentence.text,
        "targetIndex": target_index,
        "answer": target.form,
        "replacement": capitalize_like(target.form, target.lemma),
        "words": [
            {
                "text": token.form,
                "spaceAfter": token.space_after,
            }
            for token in sentence.tokens
        ],
        "sourceSentenceId": sentence.sentence_id,
    }


def build_corpus(sentences: list[Sentence]) -> dict[str, object]:
    exercises: dict[str, list[dict[str, object]]] = {}

    for feature, xpos in FEATURES.items():
        candidates: list[tuple[Sentence, int]] = []
        for sentence in sentences:
            if not usable_sentence(sentence):
                continue
            indices = target_indices(sentence, xpos)
            if indices:
                candidates.append((sentence, indices[0]))

        candidates.sort(key=lambda item: quality_key(*item))
        selected = candidates[:MAX_EXERCISES_PER_FEATURE]
        if len(selected) < MIN_EXERCISES_PER_FEATURE:
            raise RuntimeError(
                f"Only {len(selected)} usable {feature} exercises were generated; "
                f"at least {MIN_EXERCISES_PER_FEATURE} are required."
            )
        exercises[feature] = [
            exercise_record(sentence, feature, target_index)
            for sentence, target_index in selected
        ]

    return {
        "meta": {
            "source": "UD English PUD",
            "version": SOURCE_VERSION,
            "sourceUrl": SOURCE_PAGE,
            "downloadUrl": SOURCE_URL,
            "sha256": SOURCE_SHA256,
            "license": LICENSE_NAME,
            "licenseUrl": LICENSE_URL,
            "adaptation": "One tagged verb form is replaced with its lemma for each exercise.",
        },
        "exercises": exercises,
    }


def main() -> int:
    args = arguments()
    payload = load_source(args.input)
    corpus = build_corpus(parse_sentences(payload))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    counts = ", ".join(
        f"{feature}={len(records)}"
        for feature, records in corpus["exercises"].items()
    )
    print(f"Wrote {args.output} ({counts}).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, UnicodeError) as error:
        print(f"corpus update failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
