/*
Reload all loaded modules that were loaded using require-reload
 */

var index = require("../index.js");

exports.refresh = function(callback) {
	// reload the in the context of index.js
	var reloadInContext = require("require-reload")(index.requireCtx);

	callback(false);
}