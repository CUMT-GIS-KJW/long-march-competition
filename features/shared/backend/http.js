function send(
  response,
  status,
  body,
  contentType = "application/json; charset=utf-8",
) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  });

  if (Buffer.isBuffer(body) || typeof body === "string") {
    response.end(body);
    return;
  }

  response.end(JSON.stringify(body));
}

function sendSuccess(response, data) {
  send(response, 200, {
    code: 200,
    message: "success",
    data,
  });
}

function sendError(response, status, message) {
  send(response, status, {
    code: status,
    message,
    data: null,
  });
}

module.exports = {
  send,
  sendSuccess,
  sendError,
};
