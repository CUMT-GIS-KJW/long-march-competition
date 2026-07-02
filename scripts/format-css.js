const fs = require("fs");
const path = require("path");

function formatCss(source) {
  let result = "";
  let indent = 0;
  let quote = null;
  let inComment = false;

  const indentation = () => "  ".repeat(indent);

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (inComment) {
      result += character;

      if (character === "*" && next === "/") {
        result += next;
        index += 1;
        inComment = false;
      }

      continue;
    }

    if (quote) {
      result += character;

      if (character === quote && source[index - 1] !== "\\") {
        quote = null;
      }

      continue;
    }

    if (character === "/" && next === "*") {
      inComment = true;
      result += "/*";
      index += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      result += character;
      continue;
    }

    if (character === "{") {
      result = result.trimEnd();
      result += " {\n";
      indent += 1;
      result += indentation();
      continue;
    }

    if (character === ";") {
      result = result.trimEnd();
      result += ";\n" + indentation();
      continue;
    }

    if (character === "}") {
      result = result.trimEnd();
      indent = Math.max(0, indent - 1);
      result += "\n" + indentation() + "}\n\n" + indentation();
      continue;
    }

    if (character === "\n" || character === "\r" || character === "\t") {
      if (!result.endsWith(" ") && !result.endsWith("\n")) {
        result += " ";
      }
      continue;
    }

    result += character;
  }

  return result.trim() + "\n";
}

const roots = [
  path.join(__dirname, "..", "features"),
  path.join(__dirname, "..", "data"),
];

function walk(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(filePath);
      return;
    }

    if (entry.name.endsWith(".css")) {
      const source = fs.readFileSync(filePath, "utf8");
      fs.writeFileSync(filePath, formatCss(source), "utf8");
    }

    if (entry.name.endsWith(".json")) {
      const source = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(source);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    }
  });
}

roots.filter((root) => fs.existsSync(root)).forEach(walk);
