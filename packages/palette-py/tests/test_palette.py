import sondalab_palette as p


def test_roles_present():
    assert set(p.ROLES) == {"prompt", "ok", "warn", "err", "dim", "accent"}


def test_named_floor(monkeypatch):
    monkeypatch.delenv("COLORTERM", raising=False)
    monkeypatch.delenv("NO_COLOR", raising=False)
    assert p.paint("x", "ok") == "\033[32mx\033[0m"


def test_truecolor(monkeypatch):
    monkeypatch.setenv("COLORTERM", "truecolor")
    monkeypatch.delenv("NO_COLOR", raising=False)
    assert p.paint("x", "ok") == "\033[38;2;98;208;148mx\033[0m"


def test_no_color(monkeypatch):
    monkeypatch.setenv("NO_COLOR", "1")
    assert p.paint("x", "ok") == "x"


def test_unknown_role_passthrough(monkeypatch):
    monkeypatch.delenv("NO_COLOR", raising=False)
    assert p.paint("x", "nope") == "x"
