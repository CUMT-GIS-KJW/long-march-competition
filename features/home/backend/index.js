const {
  getRouteLayerConfigs,
  getRouteFeatureCollection,
  readDataFile,
  sortEventTimeline,
  sortRouteAnimation,
} = require("../../shared/backend/data-store");

function handleRouteApi(pathname, sendSuccess, sendError, response) {
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

  if (!match) {
    return false;
  }

  const layerKey = decodeURIComponent(match[1]);
  const mode = match[2];
  const collection = getRouteFeatureCollection(layerKey);

  if (!collection) {
    sendError(response, 404, `Route layer not found: ${layerKey}`);
    return true;
  }

  if (mode === "animation") {
    sendSuccess(response, sortRouteAnimation(collection));
    return true;
  }

  sendSuccess(response, collection);
  return true;
}

function handleEventApi(pathname, sendSuccess, sendError, response) {
  if (pathname !== "/api/events" && pathname !== "/api/events/timeline") {
    return false;
  }

  try {
    const collection = readDataFile("events-important.json");

    if (pathname === "/api/events/timeline") {
      sendSuccess(response, sortEventTimeline(collection));
      return true;
    }

    sendSuccess(response, collection);
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Event data load failed");
  }

  return true;
}

function handleResourceApi(pathname, sendSuccess, sendError, response) {
  const resourceEndpoints = new Set([
    "/api/routes",
    "/api/resources",
    "/api/red-tourism/resources",
  ]);

  if (!resourceEndpoints.has(pathname)) {
    return false;
  }

  const files = {
    "/api/routes": "routes.json",
    "/api/resources": "resources.json",
    "/api/red-tourism/resources": "resources.json",
  };

  try {
    sendSuccess(response, readDataFile(files[pathname]));
  } catch (error) {
    console.error(error);
    sendError(response, 500, "Resource data load failed");
  }

  return true;
}

function handleApi({ pathname, response, sendSuccess, sendError }) {
  return (
    handleRouteApi(pathname, sendSuccess, sendError, response) ||
    handleEventApi(pathname, sendSuccess, sendError, response) ||
    handleResourceApi(pathname, sendSuccess, sendError, response)
  );
}

module.exports = {
  handleApi,
};
