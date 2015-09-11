/* eslint-env mocha */

var assert = require('chai').assert;

var auth = require('../../api/auth');
var request = require('../../api/request');
var aois = require('../../api/aois');
// var urls = require('../../api/urls');
// var util = require('../../api/util');

// var AOIS = 'https://api.planet.com/v0/aois/';

describe('api/aois', function() {

  var post = request.post;
  beforeEach(function() {
  });

  afterEach(function() {
    request.post = post;
    auth.logout();
  });

  describe('create()', function() {

    it('creates an aoi', function(done) {
      var geojson = {
        'type': 'FeatureCollection',
        'features': [{
          'type': 'Feature',
          'properties': {},
          'geometry': {
            'type': 'Polygon',
            'coordinates': [[
              [50, 50],
              [50, 51],
              [51, 50],
              [50, 50]
            ]]
          }
        }]
      };

      var geofile = {
        name: 'aoi.json',
        toString: function() {
          return JSON.stringify(geojson);
        }
      };

      // var promise = aois.create(geofile);
      aois.create(geofile);
    });

  });

});
