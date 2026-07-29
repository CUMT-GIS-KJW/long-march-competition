const {
  getRouteLayerConfigs,
  getRouteFeatureCollection,
  readDataFile,
  sortEventTimeline,
  sortRouteAnimation,
} = require("../../shared/backend/data-store");

const resourceFiles = {
  "/api/routes": "routes.json",
  "/api/resources": "resources.json",
  "/api/red-tourism/resources": "resources.json",
};

function handleRouteApi(pathname, response, sendSuccess, sendError) {
  if (pathname === "/api/route-layers") {
    try {
      sendSuccess(response, getRouteLayerConfigs());
    } catch (error) {
      console.error(error);
      sendError(response, 500, "Route layer config load failed");
    }
    return true;
  }

  const match = pathname.match(/^\/api\/route-layers\/([^/]+)\/(features|animation)$/);
  if (!match) return false;

  const collection = getRouteFeatureCollection(decodeURIComponent(match[1]));
  if (!collection) {
    sendError(response, 404, `Route layer not found: ${match[1]}`);
    return true;
  }

  sendSuccess(response, match[2] === "animation" ? sortRouteAnimation(collection) : collection);
  return true;
}

function handleEventApi(pathname, response, sendSuccess, sendError) {
  if (pathname !== "/api/events" && pathname !== "/api/events/timeline") return false;

  try {
    const collection = readDataFile("events-important.json");
    sendSuccess(response, pathname === "/api/events/timeline" ? sortEventTimeline(collection) : collection);
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Event data load failed");
  }
  return true;
}

function handleResourceApi(pathname, response, sendSuccess, sendError) {
  const filename = resourceFiles[pathname];
  if (!filename) return false;

  try {
    sendSuccess(response, readDataFile(filename));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Resource data load failed");
  }
  return true;
}

function handleApi({ pathname, response, sendSuccess, sendError }) {
  return (
    handleRouteApi(pathname, response, sendSuccess, sendError) ||
    handleEventApi(pathname, response, sendSuccess, sendError) ||
    handleResourceApi(pathname, response, sendSuccess, sendError)
  );
}

module.exports = { handleApi };
