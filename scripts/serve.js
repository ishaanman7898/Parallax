// Runs the website and API at http://HOST:PORT. Pass --offline to use the saved feeds in test/fixtures.
const path = require("path");

if (process.argv.includes("--offline")) process.env.PARALLAX_FIXTURES = path.join(__dirname, "..", "test", "fixtures");

const { start } = require("../server");
const port = Number(process.env.PORT) || 5173;
const host = process.env.HOST || "127.0.0.1";

start(port, host).then(({ port }) => console.log(`Parallax running at http://${host}:${port}`));
