# WebWrite

Chrome extension to **draw and write on any website** with smooth ink, brush pressure, shapes, highlighter, and more.

## Features

- **Smooth pen** — interpolated strokes with round caps (no jagged segments)
- **Brush** — stylus pressure + speed taper for natural handwriting
- **Highlighter**, **Eraser**, **Line**, **Arrow**
- Hold **Shift** while drawing to snap a straight line with any ink tool
- Preset colors + custom picker, **thickness** (1–64 px), **opacity**
- **Undo / Redo**, export **PNG/PDF** (full page or drawings only)
- Settings remembered across sessions (`chrome.storage.local`)
- **Sheet backgrounds** — presets + custom; **Sheet** menu contrast follows page/sheet color
- **Eraser size** — dedicated slider (4–120 px), independent of pen size
- **Text** — Hand-drawn / Normal / Code fonts; `$x^2$` and `$$\frac{a}{b}$$` for math (KaTeX)
- **Ink→Text** — drag a box over ink; OCR runs, text appears on canvas (edit inline if needed)
- **Minimize** — collapse toolbar to a draggable ✎ button; click to expand
- **Record** — Video + audio, video only, or **audio only** (`.webm` downloads on Stop; **Save rec** re-downloads last)
- **+ Page** — extends the document; **scroll the website normally** (wheel/trackpad) to reach blank pages below
- Toggle: popup or **Alt+Shift+D** · exit: **Esc**

## Install (unpacked)

1. `chrome://extensions` → **Developer mode** → **Load unpacked**
2. Select the `webwrite` folder (contains `manifest.json`)
3. Open a site → WebWrite icon → **Turn on**

## Toolbar quick reference

| Tool | Use |
|------|-----|
| Pen | Smooth uniform strokes |
| Brush | Pressure-sensitive (trackpad/stylus) |
| Highlight | Semi-transparent marker |
| Line / Arrow | Click start, drag, release |
| Text | Click to type; pick font style in toolbar |
| Ink→Text | Box ink, then type styled text (replaces ink in box) |
| Export | PNG or PDF — **page + drawings** or **drawings only** |

**Export notes:** “Page + drawings” captures the visible tab (website background + your ink). The toolbar is hidden for that screenshot. “Drawings only” exports just the ink layer (transparent PNG/PDF).

## Chrome Web Store zip

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

Output: `dist/webwrite-chrome.zip`

## License

MIT — see [LICENSE](LICENSE).
