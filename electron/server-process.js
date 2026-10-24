// Runs the news and market server in its own process. Analyzing a news edition takes a few
// seconds of steady work, and in the main process that froze the window ("Not responding").
const { start } = require("../server");

start(0, "127.0.0.1", { dataDir: process.argv[2], desktop: true })
  .then(({ port }) => process.parentPort.postMessage({ port }))
  .catch((err) => {
    process.parentPort.postMessage({ error: err.message });
    process.exit(1);
  });
