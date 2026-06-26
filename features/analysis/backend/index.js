const { readDataFile } = require("../../shared/backend/data-store");

const analysisFiles = {
  "/api/analysis/summary": "analysis-summary.json",
  "/api/analysis/province": "analysis-province.json",
  "/api/analysis/elevation": "analysis-elevation.json",
  "/api/analysis/buffer": "analysis-buffer.json",
  "/api/analysis/stage": "analysis-stage.json",
};

function handleApi({ pathname, response, sendSuccess, sendError }) {
  const filename = analysisFiles[pathname];

  if (!filename) {
    return false;
  }

  try {
    sendSuccess(response, readDataFile(filename));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Analysis data load failed");
  }

  return true;
}

module.exports = {
  handleApi,
};
