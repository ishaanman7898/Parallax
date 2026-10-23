# Contributing to Parallax

Thanks for helping out. Fork the repo, create a branch off `main` and open a pull request when your change is ready.

## Local setup

Install dependencies with `npm install`. Run `npm run web` for the website and API, `npm start` for the desktop app, and `npm test` before opening a pull request. If you are offline or a feed is down, `npm run web:offline` serves the saved feeds in `test/fixtures`.

## Guidelines

Keep `src` free of a build step so it can still be hosted as plain static files. Server logic goes in `server`, with one module per job. New data sources must be free and keyless, and should fail without breaking the rest of the page.

Changes to outlet ratings in `server/sources.js` should cite the published rating they follow. Changes to the phrase lists in `server/bias.js` should add phrases that are clearly coded to one side, with a test that shows the match. Add a saved feed to `test/fixtures` when you add a new feed format.

Commit messages should be a single line.

## Reporting issues

Open a GitHub issue with steps to reproduce, the platform you were on and whether it happened on the web, the desktop app or both. For a wrong lean or tone score, include the headline and the score you saw.
