# WebWrite

Chrome extension to **draw and write on any website** (YouTube, ChatGPT, news sites, etc.) with a pen, custom colors, adjustable thickness, eraser, highlighter, and undo/redo.

## Features

- Full-page transparent overlay — ink stays on top while you draw
- **Pen**, **Highlighter** (semi-transparent), and **Eraser**
- Preset colors plus a custom color picker
- Stroke thickness from 1–48 px
- **Undo / Redo** (toolbar or **Ctrl+Z** / **Ctrl+Y**)
- Clear canvas for the current page
- Drawings persist for the session (per URL) until you close the tab
- Toggle from the extension popup or **Alt+Shift+D**
- **Esc** exits drawing mode (page clicks work normally when drawing is off)

## Install (developer / unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `webwrite` (the one containing `manifest.json`)
5. Open any normal website, click the WebWrite icon, and click **Turn on**

> Drawing is not available on `chrome://` pages or the Chrome Web Store — that is a browser restriction.

## Usage

1. Click **Turn on** in the popup (or use **Alt+Shift+D**).
2. Use the floating toolbar: pick a tool, color, and thickness.
3. Draw with mouse, trackpad, or touch/stylus where supported.
4. Click **Exit** or **Turn off** (or **Esc**) to interact with the site again.

## Chrome Web Store package

From the `webwrite` folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1
```

This creates `dist/webwrite-chrome.zip` for upload to the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) (one-time developer registration fee applies).

## Project layout

```
webwrite/
  manifest.json
  background/background.js   # Tab state, keyboard shortcut, re-inject
  content/content.js         # Canvas overlay + toolbar
  popup/                     # Enable/disable UI
  icons/
  scripts/                   # Icons + store zip helpers
```

## License

MIT — see [LICENSE](LICENSE).
