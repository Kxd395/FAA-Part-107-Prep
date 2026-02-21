const categories = require("./categories.json");
const regulations = require("./questions/regulations.json");
const airspace = require("./questions/airspace.json");
const weather = require("./questions/weather.json");
const operations = require("./questions/operations.json");
const loadingPerformance = require("./questions/loading_performance.json");

const questionsByCategory = {
  regulations,
  airspace,
  weather,
  operations,
  loadingPerformance,
};

module.exports = {
  categories,
  questionsByCategory,
  allQuestions: [
    ...regulations,
    ...airspace,
    ...weather,
    ...operations,
    ...loadingPerformance,
  ],
};
