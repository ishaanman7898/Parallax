# Parallax

Parallax is a news reader that shows how each story is framed. Every headline carries a left, center or right perspective label with a short framing note, alongside a scrolling market ticker and a market pulse panel. The same code runs as a website and as a desktop app built with Electron.

All news, prices and perspective labels in this repo are sample data. Nothing here is live or financial advice.

## Features

The home page has a top story, a market pulse card with an intraday bar chart and watchlist, a grid of stories and a perspective explainer. Headline search filters stories as you type. Latest news lists every story by publish time, Markets shows a price table with related coverage and Understanding bias explains what the labels mean. Each story opens into a full article with its framing note. The layout adapts to phone, tablet and desktop widths.

## Getting started

You need Node.js 18 or newer.

```bash
npm install
npm run web     # website at http://localhost:5173
npm start       # desktop app
```

Set the `PORT` environment variable to serve the website on a different port.

[Node.js downloads](https://nodejs.org/en/download)

## Desktop builds

Installers are built with electron-builder and written to `dist`.

```bash
npm run dist:win     # Windows installer
npm run dist:mac     # macOS disk image
npm run dist:linux   # Linux AppImage
```

macOS builds need to run on a Mac. The app icon lives in `build/icon.png`.

[Electron docs](https://www.electronjs.org/docs/latest) and [electron-builder docs](https://www.electron.build)

## Hosting the website

The `src` folder is a complete static site with no build step. Upload it to any static host such as GitHub Pages, Netlify or Cloudflare Pages and point the host at `src` as the publish directory.

[GitHub Pages docs](https://docs.github.com/en/pages)

## Project structure

```
src/            static site shared by web and desktop
  index.html    page shell, header, ticker and footer
  styles.css    theme and responsive layout
  app.js        hash router and page rendering
  data.js       sample stories, ticker and market pulse data
  assets/       hero illustration and icon
electron/       Electron main process
scripts/        local web server
build/          desktop app icon
```

Routes are hash based (`#/latest`, `#/markets`, `#/bias`, `#/story/<id>`), so they work from a file path inside Electron and on any static host.

[MDN on hashchange](https://developer.mozilla.org/en-US/docs/Web/API/Window/hashchange_event)

## Using real data

Replace the objects in `src/data.js` with data from a news API or market feed. The renderer expects the same fields, and every value is escaped before it reaches the page. If you fetch from an outside domain, add that domain to `connect-src` in the Content Security Policy in `src/index.html`.

[MDN on Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Security

The desktop window runs with context isolation and the sandbox on, and Node integration off. External links open in the system browser instead of inside the app.

[Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security)

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Parallax is released under the [MIT License](LICENSE).
