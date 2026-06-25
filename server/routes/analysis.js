const analysisTypes = [
  "summary",
  "province",
  "elevation",
  "buffer",
  "stage",
];

module.exports = analysisTypes.map((name) => ({
  method: "GET",
  path: `/api/analysis/${name}`,
  source: `public/assets/data/analysis-${name}.json`,
}));
