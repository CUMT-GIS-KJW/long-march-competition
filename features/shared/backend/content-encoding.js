// Respect explicit exclusions and quality preferences; prefer Brotli on ties.
function acceptedEncoding(value = "") {
  const qualities = new Map();
  for (const entry of String(value).toLowerCase().split(",")) {
    const [name, ...parameters] = entry.trim().split(";");
    const quality = parameters.find((parameter) => /^\s*q\s*=/.test(parameter));
    const number = quality ? Number(quality.split("=")[1].trim()) : 1;
    qualities.set(name.trim(), Number.isFinite(number) && number >= 0 && number <= 1 ? number : 0);
  }
  let selected = "";
  let bestQuality = 0;
  for (const name of ["br", "gzip"]) {
    const quality = qualities.get(name) ?? qualities.get("*") ?? 0;
    if (quality > bestQuality) {
      selected = name;
      bestQuality = quality;
    }
  }
  // Identity is acceptable by default, but only an explicit preference outranks compression.
  return (qualities.get("identity") ?? 0) > bestQuality ? "" : selected;
}

module.exports = { acceptedEncoding };
