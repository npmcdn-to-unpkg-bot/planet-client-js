/**
 * Provides methods for listing and creating aois.
 * @module planet-client/api/aois
 */

var request = require('./request');
var urls = require('./urls');
var FormData = require('form-data');

/**
 * Get metadata for a single uploaded aoi.
 * @param {string} id A mosaic identifier.
 * @param {Object} options Options.
 * @param {function(function())} options.terminator A function that is called
 *     with a function that can be called back to terminate the request.
 * @return {Promise.<Object>} A promise that resolves to aoi metadata or is
 *     rejected with any error.  See the [`errors`
 *     module](#module:planet-client/api/errors) for a list of the possible
 *     error types.
 */
function get(id, options) {
  options = options || {};
  var config = {
    url: urls.aois(id),
    terminator: options.terminator
  };
  return request.get(config).then(function(res) {
    return res.body;
  });
}

/**
 * List all of your previously uploaded aois.
 * @param {string} id An aoi public id.
 * @param {Object} options Options.
 * @param {function(function())} options.terminator A function that is called
 *     with a function that can be called back to terminate the request.
 * @return {Promise.<Object[]>} A promise that resolves to an array of aoi
 *     metadata or is rejected with any error.  See the [`errors` module]
 *     (#module:planet-client/api/errors) for a list of the possible error
 *     types.
 */
function list(id, options) {
  options = options || {};
  var config = {
    url: urls.aois(),
    terminator: options.terminator
  };
  return request.get(config).then(function(res) {
    return res.body;
  });
}

/**
 * Creates a new aoi using uploaded json data.
 * @param {File} file
 *     A [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object.
 * @param {Object} options Options.
 * @param {function(function())} options.terminator A function that is called
 *     with a function that can be called back to terminate the request.
 * @return {Promise.<Object[]>} A promise that resolves to an array of aoi
 *     metadata or is rejected with any error.  See the [`errors` module]
 *     (#module:planet-client/api/errors) for a list of the possible error
 *     types.
 */
function create(file, options) {
  var data = new FormData();
  data.append(file.name, 'testing', {filename: 'testing'});

  options = options || {};
  var config = {
    url: urls.aois(''),
    file: {
      name: 'aoi.json',
      getAsText: function() {
        return JSON.stringify({'hello': '√√√world'});
      }
    },
    terminator: options.terminator
  };
  /* eslint-disable */
  console.log(config);
  /* eslint-enable */
  return request.post(config).then(function(res) {
    return res.body;
  });
}

exports.get = get;
exports.list = list;
exports.create = create;
