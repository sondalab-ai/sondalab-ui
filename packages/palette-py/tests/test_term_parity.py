"""The golden cases term.js is held to (scripts/fixtures/term-parity.json) still match term.py.

@sondalab/ui-kit's term.js must give the bytes this package gives. Node asserts
term.js against the fixture (scripts/term-parity.test.mjs); this asserts the
fixture against term.py, so a change to either side fails CI. On a deliberate
change, rerun scripts/gen-term-parity.py and port the change to term.js.
"""
import importlib.util
import json
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
GEN = REPO / "scripts" / "gen-term-parity.py"
FIXTURE = REPO / "scripts" / "fixtures" / "term-parity.json"

pytestmark = pytest.mark.skipif(not GEN.exists(), reason="needs the sondalab-ui checkout")


def _gen():
    spec = importlib.util.spec_from_file_location("gen_term_parity", GEN)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_fixture_matches_term_py():
    gen = _gen()
    fresh = [gen.run(c) for c in gen.cases()]
    stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert len(stored) == len(fresh), "case list changed: rerun scripts/gen-term-parity.py"
    for i, (want, got) in enumerate(zip(stored, fresh)):
        assert got == want, f"case #{i} {want['fn']}: rerun scripts/gen-term-parity.py and port to term.js"
