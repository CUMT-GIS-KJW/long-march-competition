exports.get = (name) => {
  return require(`../../public/assets/data/analysis-${name}.json`);
};
