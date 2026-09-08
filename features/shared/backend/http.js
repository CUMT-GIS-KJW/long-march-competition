const zlib = require("zlib");
const { pipeline } = require("stream");
const { acceptedEncoding } = require("./content-encoding");

const MIN_COMPRESS_BYTES = 1024;

function serializeBody(body) {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  return Buffer.from(JSON.stringify(body));
}

function isCompressible(contentType) {
  return /^(application\/(json|javascript)|text\/|application\/geo\+json)/i.test(
    contentType,
  );
}

function send(
  response,
  status,
  body,
  contentType = "application/json; charset=utf-8",
  extraHeaders = {},
) {
  const payload = serializeBody(body);
  const headers = {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    ...extraHeaders,
  };
  const encoding =
    status !== 204 &&
    payload.length >= MIN_COMPRESS_BYTES &&
    isCompressible(contentType)
      ? acceptedEncoding(response.req?.headers?.["accept-encoding"])
      : "";

  if (payload.length >= MIN_COMPRESS_BYTES && isCompressible(contentType)) {
    headers.Vary = headers.Vary ? `${headers.Vary}, Accept-Encoding` : "Accept-Encoding";
  }

  if (encoding) {
    headers["Content-Encoding"] = encoding;
  } else {
    headers["Content-Length"] = payload.length;
  }

  response.writeHead(status, headers);

  if (response.req?.method === "HEAD" || status === 204) {
    response.end();
    return;
  }

  if (encoding === "br") {
    const compressor = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    pipeline(compressor, response, () => {});
    compressor.end(payload);
    return;
  }

  if (encoding === "gzip") {
    const compressor = zlib.createGzip({ level: 6 });
    pipeline(compressor, response, () => {});
    compressor.end(payload);
    return;
  }

  response.end(payload);
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
