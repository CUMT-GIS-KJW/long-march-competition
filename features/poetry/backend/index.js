const { readDataFile } = require("../../shared/backend/data-store");

function loadPoems() {
  return readDataFile("poem.json").poems || [];
}

function handleApi({ pathname, response, sendSuccess, sendError }) {
  try {
    if (pathname === "/api/poetry-points") {
      sendSuccess(response, readDataFile("poetry-points.json"));
      return true;
    }

    if (pathname === "/api/poetry-content") {
      sendSuccess(response, { poems: loadPoems() });
      return true;
    }

    const match = pathname.match(/^\/api\/poetry\/([^/]+)$/);
    if (match) {
      const poem = loadPoems().find((item) => item.id === match[1]);
      if (!poem) {
        sendError(response, 404, `Poem not found: ${match[1]}`);
        return true;
      }

      sendSuccess(response, poem);
      return true;
    }

    return false;
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Poetry data load failed");
    return true;
  }
}

module.exports = { handleApi };
