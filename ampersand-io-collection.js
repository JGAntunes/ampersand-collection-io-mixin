/*$AMPERSAND_VERSION*/
var extend = require('extend-object');
var AmpersandCollection = require('ampersand-collection');
var AmpersandIO = require('ampersand-io');

var events = {
  fetch: 'collection-fetch',
  onFetch: 'collection-fetch-response',
  onUpdate: 'on-model-update',
  onNew: 'on-model-new'
};

function AmpersandIOCollection(attrs, options){
  options || (options = {});
  Base.call(this, attrs, options);
  AmpersandIO.call(this, options.socket, options);
}

var IOMixin = AmpersandIO.extend({

  events: events,

  listeners: {
    onUpdate:{ 
      fn: function(data, cb){
        var model = this.get(data.id);
        model.save(data, null);
        return cb();
      },
      active: false
    },
    onNew: {
      fn: function(data, cb){
        this.create(data,{});
        return cb();
      },
      active: false
    }
  },

  // Fetch the default set of models for this collection, resetting the
  // collection when they arrive. If `reset: true` is passed, the response
  // data will be passed through the `reset` method instead of `set`.
  fetch: function(options) {
    options = options ? extend({}, options) : {};
    if (options.parse === void 0){
      options.parse = true;
    }
    var collection = this;
    var listener = {};
    var listenerKey;

    options.cb = options.callback;
    options.callback = function (err, response){
      callback(err, collection, response, options);
    };

    options.respCallback = function cb(data, cbServer){
      var method = options.reset ? 'reset' : 'set';
      collection.removeListeners([collection.events.onFetch]);
      if(cbServer){
        cbServer();
      }
      if(data.err){
        return callback(data.err, collection, data, options);
      }
      collection[method](data.response, options);
      callback(data.err, collection, data, options);
    };

    listenerKey = this.events.onFetch;
    listener[listenerKey] = {fn: options.respCallback, active: true};
    this.addListeners(listener);
    this.emit(this.events.fetch, this, options);
    return collection;
  },

  // Create a new instance of a model in this collection. Add the model to the
  // collection immediately, unless `wait: true` is passed, in which case we
  // wait for the server to agree.
  create: function(model, options) {
    options = options ? extend({}, options) : {};
    if (!(model = this._prepareModel(model, options))){
      return false;
    }
    if (!options.wait){
      this.add(model, options);
    }
    var collection = this;
    options.cb = options.callback;
    options.callback = function cb(err, model, response){
      if (err){
        return callback(err, model, response, options);
      }
      if (options.wait){
        collection.add(model, options);
      }
      callback(null, model, response, options);
    };

    model.save(null, options);
    return model;
  },

  // Get or fetch a model by Id.
  getOrFetch: function (id, options, cb) {
    if (arguments.length !== 3) {
      cb = options;
      options = {};
    }
    var self = this;
    var model = this.get(id);
    if (model){
      return cb(null, model);
    }
    function done() {
      var model = self.get(id);
      if (model) {
        if (cb){
          cb(null, model);
        }
      } else {
        cb(new Error('not found'));
      }
    }
    if (options.all) {
      this.fetch({
        callback: done
      });
    } else {
      this.fetchById(id, cb);
    }
  },

  // fetchById: fetches a model and adds it to
  // collection when fetched.
  fetchById: function (id, cb) {
    var self = this;
    var idObj = {};
    idObj[this.model.prototype.idAttribute] = id;
    var model = new this.model(idObj, {collection: this});
    model.fetch({
      callback: function (err) {
        if(err){
          delete model.collection;
          if (cb){
            cb(Error('not found'));
          }
          return;
        }
        self.add(model);
        if (cb){
          return cb(null, model);
        }
      }
    });
  }

});

// Aux func used to trigger errors if they exist and use the optional
// callback function if given
var callback = function(err, model, response, options){
  if (options.cb){
    options.cb(err, model, response);
  }
  if (err){
    model.trigger('error', err, model, options);
  }
};

var Base = AmpersandCollection.extend();
AmpersandIOCollection.prototype = Object.create(Base.prototype);
extend(AmpersandIOCollection.prototype, IOMixin.prototype);
AmpersandIOCollection.extend = Base.extend;

module.exports = AmpersandIOCollection;