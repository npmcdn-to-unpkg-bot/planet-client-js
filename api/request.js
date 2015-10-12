/**
 * Provides methods for issuing API requests.
 * @module planet-client/api/request
 * @private
 */

var fetch = require('isomorphic-fetch');
var path = require('path');
var url = require('url');

var bole = require('bole');

var assign = require('./util').assign;
var util = require('./util');
var authStore = require('./auth-store');
var errors = require('./errors');

var log = bole(path.basename(__filename, '.js'));

var defaultHeaders = {
  'accept': 'application/json'
};

var boundary = generateBoundary();

/**
 * Generate fetch options provided a config object.
 * @param {Object} config A request config.
 * @return {Object} An object with a url and init property for use with the
 *     fetch function.
 * @private
 */
function parseConfig(config) {
  var base;

  if (config.url) {
    var resolved;
    var currentLocation = util.currentLocation();

    if (typeof currentLocation !== 'undefined') {
      resolved = url.resolve(currentLocation.href, config.url);
    } else {
      resolved = config.url;
    }
    base = url.parse(resolved, true);
  } else {
    base = {query: {}};
  }
  if (config.query) {
    config.path = url.format({
      pathname: base.pathname || config.pathname || '/',
      query: assign(base.query, config.query)
    });
  }
  config = assign(base, config);

  var headers = assign({}, defaultHeaders);
  for (var key in config.headers) {
    headers[key.toLowerCase()] = config.headers[key];
  }
  var body;
  if (config.body) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(config.body);
    headers['content-length'] = body.length;
  }
  if (config.file) {
    headers['content-type'] = 'multipart/form-data; boundary=' + boundary;
    body = toMultipartUpload(config.file);
    headers['content-length'] = byteCount(body);
  }

  if (config.withCredentials !== false) {
    var token = authStore.getToken();
    var apiKey = authStore.getKey();
    if (token) {
      headers.authorization = 'Bearer ' + token;
    } else if (apiKey) {
      headers.authorization = 'api-key ' + apiKey;
    }
  }

  var options = {
    url: url.format(config),
    init: {
      method: config.method || 'GET',
      headers: headers,
      mode: 'cors',
      credentials: config.withCredentials === false ? 'omit' : 'include',
      redirect: 'manual',
      body: body
    }
  };

  return options;
}

/**
 * Check if the response represents an error.
 * @param {IncomingMessage} response The response.
 * @param {Object} body Any parsed body (as JSON).
 * @return {errors.ResponseError} A response error (or null if none).
 */
function errorCheck(response, body) {
  var err = null;
  var status = response.status;
  if (status === 400) {
    err = new errors.BadRequest('Bad request', response, body);
  } else if (status === 401) {
    err = new errors.Unauthorized('Unauthorized', response, body);
  } else if (status === 403) {
    err = new errors.Forbidden('Forbidden', response, body);
  } else if (!(status >= 200 && status < 300)) {
    err = new errors.UnexpectedResponse('Unexpected response status: ' +
        status, response);
  }
  return err;
}

/**
 * Issue an http(s) request.
 * @param {Object} config Request config.
 * @param {string} config.url - Optional complete URL string.
 * @param {string} config.method - Optional request method (default is 'GET').
 * @param {Object} config.query - Optional object to be serialized as the query
 *     string.  Any existing query string in the URL will be extended.
 * @param {Object} config.body - Optional object that will be serialized as
 *     JSON.
 * @param {string} config.hostname - The hostname (e.g. example.com).  Will
 *     override any hostname in the URL if provided.
 * @param {string} config.port - The port (e.g. '8000').  Default based on the
 *     protocol.  Will override any port in the URL if provided.
 * @param {string} config.protocol - The protocol (e.g. 'https').  Will override
 *     any protocol in the URL if provided.
 * @param {Object} config.headers - Optional headers object.  By default JSON
 *     content-type and accept headers are set based on the context.  Any stored
 *     token will be added to an authorization header.
 * @param {boolean} config.withCredentials - Determines whether
 *     `XMLHttpRequest.withCredentials` is set (`true` by default).
 * @return {Promise<Object>} A promise that resolves on a successful
 *     response.  The object includes response and body properties, where the
 *     body is a JSON decoded object representing the response body.  Any
 *     non-200 status will result in a rejection.
 */
function request(config) {
  var options = parseConfig(config);
  var reqUrl = options.url;
  var init = options.init;
  log.debug('%s %s %j', init.method, reqUrl, init.headers);

  return new Promise(function(resolve, reject) {
    var meta = {
      aborted: false,
      stream: config.stream,
      resolve: resolve,
      reject: reject
    };

    if (config.terminator) {
      config.terminator(function() {
        meta.aborted = true;
        reject(new errors.AbortedRequest('Request aborted'));
      });
    }

    fetch(reqUrl, init)
      .then(createResponseHandler(meta))
      .catch(createErrorHandler(meta));
  });
}

function createResponseHandler(meta) {
  return function(response) {
    if (meta.aborted) {
      return;
    }

    if (response.status === 302) {
      log.debug('Following redirect: ' + response.headers.location);
      fetch(response.headers.location)
        .then(createResponseHandler(meta))
        .catch(createErrorHandler(meta));
      return;
    }

    if (meta.stream) {
      var streamErr = errorCheck(response, null);
      if (streamErr) {
        meta.reject(streamErr);
      } else {
        meta.resolve({response: response, body: null});
      }
      return;
    }

    response.json().then(function(body) {
      var err = errorCheck(response, body);
      if (err) {
        meta.reject(err);
      } else {
        meta.resolve({response: response, body: body});
      }
    }).catch(function(_) {
      var resErr = errorCheck(response, null);
      if (resErr) {
        meta.reject(resErr);
      } else {
        meta.reject(new errors.UnexpectedResponse(
            'Trouble parsing response body as JSON', response, null));
      }
    });
  }
}

function createErrorHandler(meta) {
  return function(err) {
    // TODO: network error
    meta.reject(err);
  }
}

/**
 * Issue a GET request.
 * @param {string|Object} config A URL or request config.
 * @param {string} config.url A URL or request config.
 * @return {Promise<Object>} A promise that resolves on a successful
 *     response.  The object includes response and body properties, where the
 *     body is a JSON decoded object representing the response body.  Any
 *     non-200 status will result in a rejection.
 */
function get(config) {
  if (typeof config === 'string') {
    config = {
      url: config,
      method: 'GET'
    };
  }
  return request(config);
}

/**
 * Issue a POST request.
 * @param {Object} config The request config.
 * @return {Promise<Object>} A promise that resolves on a successful
 *     response.  The object includes response and body properties, where the
 *     body is a JSON decoded object representing the response body.  Any
 *     non-200 status will result in a rejection.
 */
function post(config) {
  return request(assign({method: 'POST'}, config));
}

/**
 * Issue a PUT request.
 * @param {Object} config The request config.
 * @return {Promise<Object>} A promise that resolves on a successful
 *     response.  The object includes response and body properties, where the
 *     body is a JSON decoded object representing the response body.  Any
 *     non-200 status will result in a rejection.
 */
function put(config) {
  return request(assign({method: 'PUT'}, config));
}

/**
 * Issue a DELETE request.
 * @param {Object} config The request config.
 * @return {Promise<Object>} A promise that resolves on a successful
 *     response.  The object includes response and body properties, where the
 *     body is a JSON decoded object representing the response body.  Any
 *     non-200 status will result in a rejection.
 */
function del(config) {
  return request(assign({method: 'DELETE'}, config));
}

/**
 * Converts a file object to a multipart payload. The file is assumed to have
 * textual content and to conform to the
 * [File](https://developer.mozilla.org/en-US/docs/Web/API/File) interface.
 *
 * Note: this isn't binary-safe.
 *
 * @param {File} file A File-like object conforming to the HTML File api.
 * @return {String} A multipart request body for a file upload.
 */
function toMultipartUpload(file) {
  return [
    '--' + boundary,
    '\r\n',
    'Content-Type: application/json; charset=utf-8',
    '\r\n',
    'Content-Disposition: form-data; name="file"; filename="' + file.name + '"',
    '\r\n\r\n',
    file.contents,
    '\r\n',
    '--' + boundary + '--'
  ].join('');
}

/**
 * Returns the length in bytes of a string.
 * @param {String} source A string whose length we wish to count.
 * @return {Number} The byte-length of a string
 */
function byteCount(source) {
  return encodeURI(source).split(/%..|./).length - 1;
}

/**
 * Returns a boundary, generating a new one and memoizing it if necessary.
 *
 * @return {String} A 24 character hex string string to use as a multipart
 *   boundary.
 */
function generateBoundary() {
  var newBoundary = [];
  for (var i = 0; i < 24; i++) {
    newBoundary.push(Math.floor(Math.random() * 16).toString(16));
  }
  return newBoundary.join('');
}

exports.get = get;
exports.post = post;
exports.put = put;
exports.del = del;
exports.parseConfig = parseConfig;
exports.request = request;
