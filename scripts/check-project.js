const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      return [];
    }

    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filePath) : [filePath];
  });
}

const files = walk(projectRoot);
const errors = [];

files.filter((filePath) => filePath.endsWith(".js")).forEach((filePath) => {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    errors.push(result.stderr || `JavaScript syntax failed: ${filePath}`);
  }
});

files.filter((filePath) => filePath.endsWith(".json")).forEach((filePath) => {
  try {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`JSON parse failed: ${filePath}\n${error.message}`);
  }
});

files
  .filter((filePath) => /\.(?:css|html|js)$/i.test(filePath))
  .forEach((filePath) => {
    const source = fs.readFileSync(filePath, "utf8");
    const references = source.matchAll(
      /["'(](\/(?:assets|data|features)\/[^"'()?#\s]+)(?:[?#][^"'()\s]*)?["')]/g,
    );

    for (const match of references) {
      if (match[1].includes("{")) {
        continue;
      }

      const target = path.join(projectRoot, ...match[1].slice(1).split("/"));
      if (!fs.existsSync(target)) {
        errors.push(`Missing local reference: ${match[1]} in ${filePath}`);
      }
    }
  });

if (errors.length) {
  console.error(errors.join("\n\n"));
  process.exitCode = 1;
} else {
  console.log("Project checks passed");
}
