---
name: claude-in-chrome-the-mcp-tab-reports-visibilitystate-hidden
description: Claude-in-Chrome: the MCP tab reports visibilityState 'hidden' between tool calls, so requestAnimationFrame is frozen — any 'await new Promise(r => requestAnimationFrame(r))' inside javascript_tool hangs the renderer and times out CDP after 45s. Pointer-driven effects (rAF loops, springs, eased state) cannot be verified with synthetic PointerEvents; use computer hover -> computer wait -> computer zoom, which keeps the tab active. javascript_tool is still reliable for reading computed styles and DOM state immediately after a real hover.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-09
---
