---
name: an-effect-class-cannot-be-aliased-is-raises-specificity
description: An `.sl-fx-*` class cannot be given a shorter alias in plain CSS. Making `.sl-fx-glass` also match a composed form needs `:is(.sl-fx-glass, …)` on every rule that mentions it — 58 selector lines for glass, 174 across the five families — and `:is()` takes the specificity of its MOST SPECIFIC argument (Selectors 4), so `:is(.sl-fx-glass, .sl-compose .sl-btn)` silently lifts every glass rule from (0,1,0) to (0,2,0) and shifts override behaviour across a released layer. The JS alternative (a `compose()` pass stamping classes onto `.sl-*` elements) is dropped by the first React or Theia re-render that touches `className`, in a kit whose stated identity is framework-agnostic. The ask behind "shorter class strings" is usually knowledge, not CSS: the per-component declension ALREADY exists in `effects.css:574-587` and `:788-815` (`.sl-btn.sl-fx-glass`, `.sl-field__control.sl-fx-glass`, …), so ship the canonical string per component in `agent/catalog.md` and put only the homeless custom-property bindings in a stylesheet. See [[the-inversion-band-rebinding-is-a-custom-property-cycle]].
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-14
---
