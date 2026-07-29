const fs = require("fs");
const path = require("path");

const roots = [path.join(__dirname, "..", "data")];

function walk(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(filePath);
      return;
    }

    if (entry.name.endsWith(".json")) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    }
  });
}

roots.filter((root) => fs.existsSync(root)).forEach(walk);
