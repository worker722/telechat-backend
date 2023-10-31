// gunMiddleware.js

const Gun = require('gun');

module.exports = function gunMiddleware(req, res, next) {
  req.gun = Gun({ /* configuration options */ }); // Initialize your Gun instance here
  next();
};
