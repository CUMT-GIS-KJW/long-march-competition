const { readDataFile } = require("../../shared/backend/data-store");

function handleApi({ pathname, response, sendSuccess, sendError }) {
  if (pathname !== "/api/scene3d/focus") {
    return false;
  }

  try {
    sendSuccess(response, readDataFile("scene3d-focus.json"));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "3D scene focus data load failed");
  }

  return true;
}

module.exports = {
  handleApi,
};
