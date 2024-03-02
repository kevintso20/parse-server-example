"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.MongoStorageAdapter = void 0;
var _MongoCollection = _interopRequireDefault(require("./MongoCollection"));
var _MongoSchemaCollection = _interopRequireDefault(require("./MongoSchemaCollection"));
var _StorageAdapter = require("../StorageAdapter");
var _mongodbUrl = require("../../../vendor/mongodbUrl");
var _MongoTransform = require("./MongoTransform");
var _node = _interopRequireDefault(require("parse/node"));
var _lodash = _interopRequireDefault(require("lodash"));
var _defaults = _interopRequireDefault(require("../../../defaults"));
var _logger = _interopRequireDefault(require("../../../logger"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
// -disable-next
const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const ReadPreference = mongodb.ReadPreference;
const MongoSchemaCollectionName = '_SCHEMA';
const storageAdapterAllCollections = mongoAdapter => {
  return mongoAdapter.connect().then(() => mongoAdapter.database.collections()).then(collections => {
    return collections.filter(collection => {
      if (collection.namespace.match(/\.system\./)) {
        return false;
      }
      // TODO: If you have one app with a collection prefix that happens to be a prefix of another
      // apps prefix, this will go very very badly. We should fix that somehow.
      return collection.collectionName.indexOf(mongoAdapter._collectionPrefix) == 0;
    });
  });
};
const convertParseSchemaToMongoSchema = _ref => {
  let schema = _extends({}, _ref);
  delete schema.fields._rperm;
  delete schema.fields._wperm;
  if (schema.className === '_User') {
    // Legacy mongo adapter knows about the difference between password and _hashed_password.
    // Future database adapters will only know about _hashed_password.
    // Note: Parse Server will bring back password with injectDefaultSchema, so we don't need
    // to add _hashed_password back ever.
    delete schema.fields._hashed_password;
  }
  return schema;
};

// Returns { code, error } if invalid, or { result }, an object
// suitable for inserting into _SCHEMA collection, otherwise.
const mongoSchemaFromFieldsAndClassNameAndCLP = (fields, className, classLevelPermissions, indexes) => {
  const mongoObject = {
    _id: className,
    objectId: 'string',
    updatedAt: 'string',
    createdAt: 'string',
    _metadata: undefined
  };
  for (const fieldName in fields) {
    const _fields$fieldName = fields[fieldName],
      {
        type,
        targetClass
      } = _fields$fieldName,
      fieldOptions = _objectWithoutProperties(_fields$fieldName, ["type", "targetClass"]);
    mongoObject[fieldName] = _MongoSchemaCollection.default.parseFieldTypeToMongoFieldType({
      type,
      targetClass
    });
    if (fieldOptions && Object.keys(fieldOptions).length > 0) {
      mongoObject._metadata = mongoObject._metadata || {};
      mongoObject._metadata.fields_options = mongoObject._metadata.fields_options || {};
      mongoObject._metadata.fields_options[fieldName] = fieldOptions;
    }
  }
  if (typeof classLevelPermissions !== 'undefined') {
    mongoObject._metadata = mongoObject._metadata || {};
    if (!classLevelPermissions) {
      delete mongoObject._metadata.class_permissions;
    } else {
      mongoObject._metadata.class_permissions = classLevelPermissions;
    }
  }
  if (indexes && typeof indexes === 'object' && Object.keys(indexes).length > 0) {
    mongoObject._metadata = mongoObject._metadata || {};
    mongoObject._metadata.indexes = indexes;
  }
  if (!mongoObject._metadata) {
    // cleanup the unused _metadata
    delete mongoObject._metadata;
  }
  return mongoObject;
};
function validateExplainValue(explain) {
  if (explain) {
    // The list of allowed explain values is from node-mongodb-native/lib/explain.js
    const explainAllowedValues = ['queryPlanner', 'queryPlannerExtended', 'executionStats', 'allPlansExecution', false, true];
    if (!explainAllowedValues.includes(explain)) {
      throw new _node.default.Error(_node.default.Error.INVALID_QUERY, 'Invalid value for explain');
    }
  }
}
class MongoStorageAdapter {
  // Private

  // Public

  constructor({
    uri = _defaults.default.DefaultMongoURI,
    collectionPrefix = '',
    mongoOptions = {}
  }) {
    this._uri = uri;
    this._collectionPrefix = collectionPrefix;
    this._mongoOptions = _objectSpread({}, mongoOptions);
    this._mongoOptions.useNewUrlParser = true;
    this._mongoOptions.useUnifiedTopology = true;
    this._onchange = () => {};

    // MaxTimeMS is not a global MongoDB client option, it is applied per operation.
    this._maxTimeMS = mongoOptions.maxTimeMS;
    this.canSortOnJoinTables = true;
    this.enableSchemaHooks = !!mongoOptions.enableSchemaHooks;
    this.schemaCacheTtl = mongoOptions.schemaCacheTtl;
    for (const key of ['enableSchemaHooks', 'schemaCacheTtl', 'maxTimeMS']) {
      delete mongoOptions[key];
      delete this._mongoOptions[key];
    }
  }
  watch(callback) {
    this._onchange = callback;
  }
  connect() {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // parsing and re-formatting causes the auth value (if there) to get URI
    // encoded
    const encodedUri = (0, _mongodbUrl.format)((0, _mongodbUrl.parse)(this._uri));
    this.connectionPromise = MongoClient.connect(encodedUri, this._mongoOptions).then(client => {
      // Starting mongoDB 3.0, the MongoClient.connect don't return a DB anymore but a client
      // Fortunately, we can get back the options and use them to select the proper DB.
      // https://github.com/mongodb/node-mongodb-native/blob/2c35d76f08574225b8db02d7bef687123e6bb018/lib/mongo_client.js#L885
      const options = client.s.options;
      const database = client.db(options.dbName);
      if (!database) {
        delete this.connectionPromise;
        return;
      }
      client.on('error', () => {
        delete this.connectionPromise;
      });
      client.on('close', () => {
        delete this.connectionPromise;
      });
      this.client = client;
      this.database = database;
    }).catch(err => {
      delete this.connectionPromise;
      return Promise.reject(err);
    });
    return this.connectionPromise;
  }
  handleError(error) {
    if (error && error.code === 13) {
      // Unauthorized error
      delete this.client;
      delete this.database;
      delete this.connectionPromise;
      _logger.default.error('Received unauthorized error', {
        error: error
      });
    }
    throw error;
  }
  async handleShutdown() {
    if (!this.client) {
      return;
    }
    await this.client.close(false);
    delete this.connectionPromise;
  }
  _adaptiveCollection(name) {
    return this.connect().then(() => this.database.collection(this._collectionPrefix + name)).then(rawCollection => new _MongoCollection.default(rawCollection)).catch(err => this.handleError(err));
  }
  _schemaCollection() {
    return this.connect().then(() => this._adaptiveCollection(MongoSchemaCollectionName)).then(collection => {
      if (!this._stream && this.enableSchemaHooks) {
        this._stream = collection._mongoCollection.watch();
        this._stream.on('change', () => this._onchange());
      }
      return new _MongoSchemaCollection.default(collection);
    });
  }
  classExists(name) {
    return this.connect().then(() => {
      return this.database.listCollections({
        name: this._collectionPrefix + name
      }).toArray();
    }).then(collections => {
      return collections.length > 0;
    }).catch(err => this.handleError(err));
  }
  setClassLevelPermissions(className, CLPs) {
    return this._schemaCollection().then(schemaCollection => schemaCollection.updateSchema(className, {
      $set: {
        '_metadata.class_permissions': CLPs
      }
    })).catch(err => this.handleError(err));
  }
  setIndexesWithSchemaFormat(className, submittedIndexes, existingIndexes = {}, fields) {
    if (submittedIndexes === undefined) {
      return Promise.resolve();
    }
    if (Object.keys(existingIndexes).length === 0) {
      existingIndexes = {
        _id_: {
          _id: 1
        }
      };
    }
    const deletePromises = [];
    const insertedIndexes = [];
    Object.keys(submittedIndexes).forEach(name => {
      const field = submittedIndexes[name];
      if (existingIndexes[name] && field.__op !== 'Delete') {
        throw new _node.default.Error(_node.default.Error.INVALID_QUERY, `Index ${name} exists, cannot update.`);
      }
      if (!existingIndexes[name] && field.__op === 'Delete') {
        throw new _node.default.Error(_node.default.Error.INVALID_QUERY, `Index ${name} does not exist, cannot delete.`);
      }
      if (field.__op === 'Delete') {
        const promise = this.dropIndex(className, name);
        deletePromises.push(promise);
        delete existingIndexes[name];
      } else {
        Object.keys(field).forEach(key => {
          if (!Object.prototype.hasOwnProperty.call(fields, key.indexOf('_p_') === 0 ? key.replace('_p_', '') : key)) {
            throw new _node.default.Error(_node.default.Error.INVALID_QUERY, `Field ${key} does not exist, cannot add index.`);
          }
        });
        existingIndexes[name] = field;
        insertedIndexes.push({
          key: field,
          name
        });
      }
    });
    let insertPromise = Promise.resolve();
    if (insertedIndexes.length > 0) {
      insertPromise = this.createIndexes(className, insertedIndexes);
    }
    return Promise.all(deletePromises).then(() => insertPromise).then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.updateSchema(className, {
      $set: {
        '_metadata.indexes': existingIndexes
      }
    })).catch(err => this.handleError(err));
  }
  setIndexesFromMongo(className) {
    return this.getIndexes(className).then(indexes => {
      indexes = indexes.reduce((obj, index) => {
        if (index.key._fts) {
          delete index.key._fts;
          delete index.key._ftsx;
          for (const field in index.weights) {
            index.key[field] = 'text';
          }
        }
        obj[index.name] = index.key;
        return obj;
      }, {});
      return this._schemaCollection().then(schemaCollection => schemaCollection.updateSchema(className, {
        $set: {
          '_metadata.indexes': indexes
        }
      }));
    }).catch(err => this.handleError(err)).catch(() => {
      // Ignore if collection not found
      return Promise.resolve();
    });
  }
  createClass(className, schema) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoObject = mongoSchemaFromFieldsAndClassNameAndCLP(schema.fields, className, schema.classLevelPermissions, schema.indexes);
    mongoObject._id = className;
    return this.setIndexesWithSchemaFormat(className, schema.indexes, {}, schema.fields).then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.insertSchema(mongoObject)).catch(err => this.handleError(err));
  }
  async updateFieldOptions(className, fieldName, type) {
    const schemaCollection = await this._schemaCollection();
    await schemaCollection.updateFieldOptions(className, fieldName, type);
  }
  addFieldIfNotExists(className, fieldName, type) {
    return this._schemaCollection().then(schemaCollection => schemaCollection.addFieldIfNotExists(className, fieldName, type)).then(() => this.createIndexesIfNeeded(className, fieldName, type)).catch(err => this.handleError(err));
  }

  // Drops a collection. Resolves with true if it was a Parse Schema (eg. _User, Custom, etc.)
  // and resolves with false if it wasn't (eg. a join table). Rejects if deletion was impossible.
  deleteClass(className) {
    return this._adaptiveCollection(className).then(collection => collection.drop()).catch(error => {
      // 'ns not found' means collection was already gone. Ignore deletion attempt.
      if (error.message == 'ns not found') {
        return;
      }
      throw error;
    })
    // We've dropped the collection, now remove the _SCHEMA document
    .then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.findAndDeleteSchema(className)).catch(err => this.handleError(err));
  }
  deleteAllClasses(fast) {
    return storageAdapterAllCollections(this).then(collections => Promise.all(collections.map(collection => fast ? collection.deleteMany({}) : collection.drop())));
  }

  // Remove the column and all the data. For Relations, the _Join collection is handled
  // specially, this function does not delete _Join columns. It should, however, indicate
  // that the relation fields does not exist anymore. In mongo, this means removing it from
  // the _SCHEMA collection.  There should be no actual data in the collection under the same name
  // as the relation column, so it's fine to attempt to delete it. If the fields listed to be
  // deleted do not exist, this function should return successfully anyways. Checking for
  // attempts to delete non-existent fields is the responsibility of Parse Server.

  // Pointer field names are passed for legacy reasons: the original mongo
  // format stored pointer field names differently in the database, and therefore
  // needed to know the type of the field before it could delete it. Future database
  // adapters should ignore the pointerFieldNames argument. All the field names are in
  // fieldNames, they show up additionally in the pointerFieldNames database for use
  // by the mongo adapter, which deals with the legacy mongo format.

  // This function is not obligated to delete fields atomically. It is given the field
  // names in a list so that databases that are capable of deleting fields atomically
  // may do so.

  // Returns a Promise.
  deleteFields(className, schema, fieldNames) {
    const mongoFormatNames = fieldNames.map(fieldName => {
      if (schema.fields[fieldName].type === 'Pointer') {
        return `_p_${fieldName}`;
      } else {
        return fieldName;
      }
    });
    const collectionUpdate = {
      $unset: {}
    };
    mongoFormatNames.forEach(name => {
      collectionUpdate['$unset'][name] = null;
    });
    const collectionFilter = {
      $or: []
    };
    mongoFormatNames.forEach(name => {
      collectionFilter['$or'].push({
        [name]: {
          $exists: true
        }
      });
    });
    const schemaUpdate = {
      $unset: {}
    };
    fieldNames.forEach(name => {
      schemaUpdate['$unset'][name] = null;
      schemaUpdate['$unset'][`_metadata.fields_options.${name}`] = null;
    });
    return this._adaptiveCollection(className).then(collection => collection.updateMany(collectionFilter, collectionUpdate)).then(() => this._schemaCollection()).then(schemaCollection => schemaCollection.updateSchema(className, schemaUpdate)).catch(err => this.handleError(err));
  }

  // Return a promise for all schemas known to this adapter, in Parse format. In case the
  // schemas cannot be retrieved, returns a promise that rejects. Requirements for the
  // rejection reason are TBD.
  getAllClasses() {
    return this._schemaCollection().then(schemasCollection => schemasCollection._fetchAllSchemasFrom_SCHEMA()).catch(err => this.handleError(err));
  }

  // Return a promise for the schema with the given name, in Parse format. If
  // this adapter doesn't know about the schema, return a promise that rejects with
  // undefined as the reason.
  getClass(className) {
    return this._schemaCollection().then(schemasCollection => schemasCollection._fetchOneSchemaFrom_SCHEMA(className)).catch(err => this.handleError(err));
  }

  // TODO: As yet not particularly well specified. Creates an object. Maybe shouldn't even need the schema,
  // and should infer from the type. Or maybe does need the schema for validations. Or maybe needs
  // the schema only for the legacy mongo format. We'll figure that out later.
  createObject(className, schema, object, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoObject = (0, _MongoTransform.parseObjectToMongoObjectForCreate)(className, object, schema);
    return this._adaptiveCollection(className).then(collection => collection.insertOne(mongoObject, transactionalSession)).then(() => ({
      ops: [mongoObject]
    })).catch(error => {
      if (error.code === 11000) {
        // Duplicate value
        const err = new _node.default.Error(_node.default.Error.DUPLICATE_VALUE, 'A duplicate value for a field with unique values was provided');
        err.underlyingError = error;
        if (error.message) {
          const matches = error.message.match(/index:[\sa-zA-Z0-9_\-\.]+\$?([a-zA-Z_-]+)_1/);
          if (matches && Array.isArray(matches)) {
            err.userInfo = {
              duplicated_field: matches[1]
            };
          }
        }
        throw err;
      }
      throw error;
    }).catch(err => this.handleError(err));
  }

  // Remove all objects that match the given Parse Query.
  // If no objects match, reject with OBJECT_NOT_FOUND. If objects are found and deleted, resolve with undefined.
  // If there is some other error, reject with INTERNAL_SERVER_ERROR.
  deleteObjectsByQuery(className, schema, query, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    return this._adaptiveCollection(className).then(collection => {
      const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
      return collection.deleteMany(mongoWhere, transactionalSession);
    }).catch(err => this.handleError(err)).then(({
      deletedCount
    }) => {
      if (deletedCount === 0) {
        throw new _node.default.Error(_node.default.Error.OBJECT_NOT_FOUND, 'Object not found.');
      }
      return Promise.resolve();
    }, () => {
      throw new _node.default.Error(_node.default.Error.INTERNAL_SERVER_ERROR, 'Database adapter error');
    });
  }

  // Apply the update to all objects that match the given Parse Query.
  updateObjectsByQuery(className, schema, query, update, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoUpdate = (0, _MongoTransform.transformUpdate)(className, update, schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    return this._adaptiveCollection(className).then(collection => collection.updateMany(mongoWhere, mongoUpdate, transactionalSession)).catch(err => this.handleError(err));
  }

  // Atomically finds and updates an object based on query.
  // Return value not currently well specified.
  findOneAndUpdate(className, schema, query, update, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoUpdate = (0, _MongoTransform.transformUpdate)(className, update, schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.findOneAndUpdate(mongoWhere, mongoUpdate, {
      returnDocument: 'after',
      session: transactionalSession || undefined
    })).then(result => (0, _MongoTransform.mongoObjectToParseObject)(className, result.value, schema)).catch(error => {
      if (error.code === 11000) {
        throw new _node.default.Error(_node.default.Error.DUPLICATE_VALUE, 'A duplicate value for a field with unique values was provided');
      }
      throw error;
    }).catch(err => this.handleError(err));
  }

  // Hopefully we can get rid of this. It's only used for config and hooks.
  upsertOneObject(className, schema, query, update, transactionalSession) {
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoUpdate = (0, _MongoTransform.transformUpdate)(className, update, schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    return this._adaptiveCollection(className).then(collection => collection.upsertOne(mongoWhere, mongoUpdate, transactionalSession)).catch(err => this.handleError(err));
  }

  // Executes a find. Accepts: className, query in Parse format, and { skip, limit, sort }.
  find(className, schema, query, {
    skip,
    limit,
    sort,
    keys,
    readPreference,
    hint,
    caseInsensitive,
    explain
  }) {
    validateExplainValue(explain);
    schema = convertParseSchemaToMongoSchema(schema);
    const mongoWhere = (0, _MongoTransform.transformWhere)(className, query, schema);
    const mongoSort = _lodash.default.mapKeys(sort, (value, fieldName) => (0, _MongoTransform.transformKey)(className, fieldName, schema));
    const mongoKeys = _lodash.default.reduce(keys, (memo, key) => {
      if (key === 'ACL') {
        memo['_rperm'] = 1;
        memo['_wperm'] = 1;
      } else {
        memo[(0, _MongoTransform.transformKey)(className, key, schema)] = 1;
      }
      return memo;
    }, {});

    // If we aren't requesting the `_id` field, we need to explicitly opt out
    // of it. Doing so in parse-server is unusual, but it can allow us to
    // optimize some queries with covering indexes.
    if (keys && !mongoKeys._id) {
      mongoKeys._id = 0;
    }
    readPreference = this._parseReadPreference(readPreference);
    return this.createTextIndexesIfNeeded(className, query, schema).then(() => this._adaptiveCollection(className)).then(collection => collection.find(mongoWhere, {
      skip,
      limit,
      sort: mongoSort,
      keys: mongoKeys,
      maxTimeMS: this._maxTimeMS,
      readPreference,
      hint,
      caseInsensitive,
      explain
    })).then(objects => {
      if (explain) {
        return objects;
      }
      return objects.map(object => (0, _MongoTransform.mongoObjectToParseObject)(className, object, schema));
    }).catch(err => this.handleError(err));
  }
  ensureIndex(className, schema, fieldNames, indexName, caseInsensitive = false, options = {}) {
    schema = convertParseSchemaToMongoSchema(schema);
    const indexCreationRequest = {};
    const mongoFieldNames = fieldNames.map(fieldName => (0, _MongoTransform.transformKey)(className, fieldName, schema));
    mongoFieldNames.forEach(fieldName => {
      indexCreationRequest[fieldName] = options.indexType !== undefined ? options.indexType : 1;
    });
    const defaultOptions = {
      background: true,
      sparse: true
    };
    const indexNameOptions = indexName ? {
      name: indexName
    } : {};
    const ttlOptions = options.ttl !== undefined ? {
      expireAfterSeconds: options.ttl
    } : {};
    const caseInsensitiveOptions = caseInsensitive ? {
      collation: _MongoCollection.default.caseInsensitiveCollation()
    } : {};
    const indexOptions = _objectSpread(_objectSpread(_objectSpread(_objectSpread({}, defaultOptions), caseInsensitiveOptions), indexNameOptions), ttlOptions);
    return this._adaptiveCollection(className).then(collection => new Promise((resolve, reject) => collection._mongoCollection.createIndex(indexCreationRequest, indexOptions, error => error ? reject(error) : resolve()))).catch(err => this.handleError(err));
  }

  // Create a unique index. Unique indexes on nullable fields are not allowed. Since we don't
  // currently know which fields are nullable and which aren't, we ignore that criteria.
  // As such, we shouldn't expose this function to users of parse until we have an out-of-band
  // Way of determining if a field is nullable. Undefined doesn't count against uniqueness,
  // which is why we use sparse indexes.
  ensureUniqueness(className, schema, fieldNames) {
    schema = convertParseSchemaToMongoSchema(schema);
    const indexCreationRequest = {};
    const mongoFieldNames = fieldNames.map(fieldName => (0, _MongoTransform.transformKey)(className, fieldName, schema));
    mongoFieldNames.forEach(fieldName => {
      indexCreationRequest[fieldName] = 1;
    });
    return this._adaptiveCollection(className).then(collection => collection._ensureSparseUniqueIndexInBackground(indexCreationRequest)).catch(error => {
      if (error.code === 11000) {
        throw new _node.default.Error(_node.default.Error.DUPLICATE_VALUE, 'Tried to ensure field uniqueness for a class that already has duplicates.');
      }
      throw error;
    }).catch(err => this.handleError(err));
  }

  // Used in tests
  _rawFind(className, query) {
    return this._adaptiveCollection(className).then(collection => collection.find(query, {
      maxTimeMS: this._maxTimeMS
    })).catch(err => this.handleError(err));
  }

  // Executes a count.
  count(className, schema, query, readPreference, hint) {
    schema = convertParseSchemaToMongoSchema(schema);
    readPreference = this._parseReadPreference(readPreference);
    return this._adaptiveCollection(className).then(collection => collection.count((0, _MongoTransform.transformWhere)(className, query, schema, true), {
      maxTimeMS: this._maxTimeMS,
      readPreference,
      hint
    })).catch(err => this.handleError(err));
  }
  distinct(className, schema, query, fieldName) {
    schema = convertParseSchemaToMongoSchema(schema);
    const isPointerField = schema.fields[fieldName] && schema.fields[fieldName].type === 'Pointer';
    const transformField = (0, _MongoTransform.transformKey)(className, fieldName, schema);
    return this._adaptiveCollection(className).then(collection => collection.distinct(transformField, (0, _MongoTransform.transformWhere)(className, query, schema))).then(objects => {
      objects = objects.filter(obj => obj != null);
      return objects.map(object => {
        if (isPointerField) {
          return (0, _MongoTransform.transformPointerString)(schema, fieldName, object);
        }
        return (0, _MongoTransform.mongoObjectToParseObject)(className, object, schema);
      });
    }).catch(err => this.handleError(err));
  }
  aggregate(className, schema, pipeline, readPreference, hint, explain) {
    validateExplainValue(explain);
    let isPointerField = false;
    pipeline = pipeline.map(stage => {
      if (stage.$group) {
        stage.$group = this._parseAggregateGroupArgs(schema, stage.$group);
        if (stage.$group._id && typeof stage.$group._id === 'string' && stage.$group._id.indexOf('$_p_') >= 0) {
          isPointerField = true;
        }
      }
      if (stage.$match) {
        stage.$match = this._parseAggregateArgs(schema, stage.$match);
      }
      if (stage.$project) {
        stage.$project = this._parseAggregateProjectArgs(schema, stage.$project);
      }
      if (stage.$geoNear && stage.$geoNear.query) {
        stage.$geoNear.query = this._parseAggregateArgs(schema, stage.$geoNear.query);
      }
      return stage;
    });
    readPreference = this._parseReadPreference(readPreference);
    return this._adaptiveCollection(className).then(collection => collection.aggregate(pipeline, {
      readPreference,
      maxTimeMS: this._maxTimeMS,
      hint,
      explain
    })).then(results => {
      results.forEach(result => {
        if (Object.prototype.hasOwnProperty.call(result, '_id')) {
          if (isPointerField && result._id) {
            result._id = result._id.split('$')[1];
          }
          if (result._id == null || result._id == undefined || ['object', 'string'].includes(typeof result._id) && _lodash.default.isEmpty(result._id)) {
            result._id = null;
          }
          result.objectId = result._id;
          delete result._id;
        }
      });
      return results;
    }).then(objects => objects.map(object => (0, _MongoTransform.mongoObjectToParseObject)(className, object, schema))).catch(err => this.handleError(err));
  }

  // This function will recursively traverse the pipeline and convert any Pointer or Date columns.
  // If we detect a pointer column we will rename the column being queried for to match the column
  // in the database. We also modify the value to what we expect the value to be in the database
  // as well.
  // For dates, the driver expects a Date object, but we have a string coming in. So we'll convert
  // the string to a Date so the driver can perform the necessary comparison.
  //
  // The goal of this method is to look for the "leaves" of the pipeline and determine if it needs
  // to be converted. The pipeline can have a few different forms. For more details, see:
  //     https://docs.mongodb.com/manual/reference/operator/aggregation/
  //
  // If the pipeline is an array, it means we are probably parsing an '$and' or '$or' operator. In
  // that case we need to loop through all of it's children to find the columns being operated on.
  // If the pipeline is an object, then we'll loop through the keys checking to see if the key name
  // matches one of the schema columns. If it does match a column and the column is a Pointer or
  // a Date, then we'll convert the value as described above.
  //
  // As much as I hate recursion...this seemed like a good fit for it. We're essentially traversing
  // down a tree to find a "leaf node" and checking to see if it needs to be converted.
  _parseAggregateArgs(schema, pipeline) {
    if (pipeline === null) {
      return null;
    } else if (Array.isArray(pipeline)) {
      return pipeline.map(value => this._parseAggregateArgs(schema, value));
    } else if (typeof pipeline === 'object') {
      const returnValue = {};
      for (const field in pipeline) {
        if (schema.fields[field] && schema.fields[field].type === 'Pointer') {
          if (typeof pipeline[field] === 'object') {
            // Pass objects down to MongoDB...this is more than likely an $exists operator.
            returnValue[`_p_${field}`] = pipeline[field];
          } else {
            returnValue[`_p_${field}`] = `${schema.fields[field].targetClass}$${pipeline[field]}`;
          }
        } else if (schema.fields[field] && schema.fields[field].type === 'Date') {
          returnValue[field] = this._convertToDate(pipeline[field]);
        } else {
          returnValue[field] = this._parseAggregateArgs(schema, pipeline[field]);
        }
        if (field === 'objectId') {
          returnValue['_id'] = returnValue[field];
          delete returnValue[field];
        } else if (field === 'createdAt') {
          returnValue['_created_at'] = returnValue[field];
          delete returnValue[field];
        } else if (field === 'updatedAt') {
          returnValue['_updated_at'] = returnValue[field];
          delete returnValue[field];
        }
      }
      return returnValue;
    }
    return pipeline;
  }

  // This function is slightly different than the one above. Rather than trying to combine these
  // two functions and making the code even harder to understand, I decided to split it up. The
  // difference with this function is we are not transforming the values, only the keys of the
  // pipeline.
  _parseAggregateProjectArgs(schema, pipeline) {
    const returnValue = {};
    for (const field in pipeline) {
      if (schema.fields[field] && schema.fields[field].type === 'Pointer') {
        returnValue[`_p_${field}`] = pipeline[field];
      } else {
        returnValue[field] = this._parseAggregateArgs(schema, pipeline[field]);
      }
      if (field === 'objectId') {
        returnValue['_id'] = returnValue[field];
        delete returnValue[field];
      } else if (field === 'createdAt') {
        returnValue['_created_at'] = returnValue[field];
        delete returnValue[field];
      } else if (field === 'updatedAt') {
        returnValue['_updated_at'] = returnValue[field];
        delete returnValue[field];
      }
    }
    return returnValue;
  }

  // This function is slightly different than the two above. MongoDB $group aggregate looks like:
  //     { $group: { _id: <expression>, <field1>: { <accumulator1> : <expression1> }, ... } }
  // The <expression> could be a column name, prefixed with the '$' character. We'll look for
  // these <expression> and check to see if it is a 'Pointer' or if it's one of createdAt,
  // updatedAt or objectId and change it accordingly.
  _parseAggregateGroupArgs(schema, pipeline) {
    if (Array.isArray(pipeline)) {
      return pipeline.map(value => this._parseAggregateGroupArgs(schema, value));
    } else if (typeof pipeline === 'object') {
      const returnValue = {};
      for (const field in pipeline) {
        returnValue[field] = this._parseAggregateGroupArgs(schema, pipeline[field]);
      }
      return returnValue;
    } else if (typeof pipeline === 'string') {
      const field = pipeline.substring(1);
      if (schema.fields[field] && schema.fields[field].type === 'Pointer') {
        return `$_p_${field}`;
      } else if (field == 'createdAt') {
        return '$_created_at';
      } else if (field == 'updatedAt') {
        return '$_updated_at';
      }
    }
    return pipeline;
  }

  // This function will attempt to convert the provided value to a Date object. Since this is part
  // of an aggregation pipeline, the value can either be a string or it can be another object with
  // an operator in it (like $gt, $lt, etc). Because of this I felt it was easier to make this a
  // recursive method to traverse down to the "leaf node" which is going to be the string.
  _convertToDate(value) {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      return new Date(value);
    }
    const returnValue = {};
    for (const field in value) {
      returnValue[field] = this._convertToDate(value[field]);
    }
    return returnValue;
  }
  _parseReadPreference(readPreference) {
    if (readPreference) {
      readPreference = readPreference.toUpperCase();
    }
    switch (readPreference) {
      case 'PRIMARY':
        readPreference = ReadPreference.PRIMARY;
        break;
      case 'PRIMARY_PREFERRED':
        readPreference = ReadPreference.PRIMARY_PREFERRED;
        break;
      case 'SECONDARY':
        readPreference = ReadPreference.SECONDARY;
        break;
      case 'SECONDARY_PREFERRED':
        readPreference = ReadPreference.SECONDARY_PREFERRED;
        break;
      case 'NEAREST':
        readPreference = ReadPreference.NEAREST;
        break;
      case undefined:
      case null:
      case '':
        break;
      default:
        throw new _node.default.Error(_node.default.Error.INVALID_QUERY, 'Not supported read preference.');
    }
    return readPreference;
  }
  performInitialization() {
    return Promise.resolve();
  }
  createIndex(className, index) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.createIndex(index)).catch(err => this.handleError(err));
  }
  createIndexes(className, indexes) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.createIndexes(indexes)).catch(err => this.handleError(err));
  }
  createIndexesIfNeeded(className, fieldName, type) {
    if (type && type.type === 'Polygon') {
      const index = {
        [fieldName]: '2dsphere'
      };
      return this.createIndex(className, index);
    }
    return Promise.resolve();
  }
  createTextIndexesIfNeeded(className, query, schema) {
    for (const fieldName in query) {
      if (!query[fieldName] || !query[fieldName].$text) {
        continue;
      }
      const existingIndexes = schema.indexes;
      for (const key in existingIndexes) {
        const index = existingIndexes[key];
        if (Object.prototype.hasOwnProperty.call(index, fieldName)) {
          return Promise.resolve();
        }
      }
      const indexName = `${fieldName}_text`;
      const textIndex = {
        [indexName]: {
          [fieldName]: 'text'
        }
      };
      return this.setIndexesWithSchemaFormat(className, textIndex, existingIndexes, schema.fields).catch(error => {
        if (error.code === 85) {
          // Index exist with different options
          return this.setIndexesFromMongo(className);
        }
        throw error;
      });
    }
    return Promise.resolve();
  }
  getIndexes(className) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.indexes()).catch(err => this.handleError(err));
  }
  dropIndex(className, index) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.dropIndex(index)).catch(err => this.handleError(err));
  }
  dropAllIndexes(className) {
    return this._adaptiveCollection(className).then(collection => collection._mongoCollection.dropIndexes()).catch(err => this.handleError(err));
  }
  updateSchemaWithIndexes() {
    return this.getAllClasses().then(classes => {
      const promises = classes.map(schema => {
        return this.setIndexesFromMongo(schema.className);
      });
      return Promise.all(promises);
    }).catch(err => this.handleError(err));
  }
  createTransactionalSession() {
    const transactionalSection = this.client.startSession();
    transactionalSection.startTransaction();
    return Promise.resolve(transactionalSection);
  }
  commitTransactionalSession(transactionalSection) {
    const commit = retries => {
      return transactionalSection.commitTransaction().catch(error => {
        if (error && error.hasErrorLabel('TransientTransactionError') && retries > 0) {
          return commit(retries - 1);
        }
        throw error;
      }).then(() => {
        transactionalSection.endSession();
      });
    };
    return commit(5);
  }
  abortTransactionalSession(transactionalSection) {
    return transactionalSection.abortTransaction().then(() => {
      transactionalSection.endSession();
    });
  }
}
exports.MongoStorageAdapter = MongoStorageAdapter;
var _default = MongoStorageAdapter;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJtb25nb2RiIiwicmVxdWlyZSIsIk1vbmdvQ2xpZW50IiwiUmVhZFByZWZlcmVuY2UiLCJNb25nb1NjaGVtYUNvbGxlY3Rpb25OYW1lIiwic3RvcmFnZUFkYXB0ZXJBbGxDb2xsZWN0aW9ucyIsIm1vbmdvQWRhcHRlciIsImNvbm5lY3QiLCJ0aGVuIiwiZGF0YWJhc2UiLCJjb2xsZWN0aW9ucyIsImZpbHRlciIsImNvbGxlY3Rpb24iLCJuYW1lc3BhY2UiLCJtYXRjaCIsImNvbGxlY3Rpb25OYW1lIiwiaW5kZXhPZiIsIl9jb2xsZWN0aW9uUHJlZml4IiwiY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYSIsInNjaGVtYSIsImZpZWxkcyIsIl9ycGVybSIsIl93cGVybSIsImNsYXNzTmFtZSIsIl9oYXNoZWRfcGFzc3dvcmQiLCJtb25nb1NjaGVtYUZyb21GaWVsZHNBbmRDbGFzc05hbWVBbmRDTFAiLCJjbGFzc0xldmVsUGVybWlzc2lvbnMiLCJpbmRleGVzIiwibW9uZ29PYmplY3QiLCJfaWQiLCJvYmplY3RJZCIsInVwZGF0ZWRBdCIsImNyZWF0ZWRBdCIsIl9tZXRhZGF0YSIsInVuZGVmaW5lZCIsImZpZWxkTmFtZSIsInR5cGUiLCJ0YXJnZXRDbGFzcyIsImZpZWxkT3B0aW9ucyIsIk1vbmdvU2NoZW1hQ29sbGVjdGlvbiIsInBhcnNlRmllbGRUeXBlVG9Nb25nb0ZpZWxkVHlwZSIsIk9iamVjdCIsImtleXMiLCJsZW5ndGgiLCJmaWVsZHNfb3B0aW9ucyIsImNsYXNzX3Blcm1pc3Npb25zIiwidmFsaWRhdGVFeHBsYWluVmFsdWUiLCJleHBsYWluIiwiZXhwbGFpbkFsbG93ZWRWYWx1ZXMiLCJpbmNsdWRlcyIsIlBhcnNlIiwiRXJyb3IiLCJJTlZBTElEX1FVRVJZIiwiTW9uZ29TdG9yYWdlQWRhcHRlciIsImNvbnN0cnVjdG9yIiwidXJpIiwiZGVmYXVsdHMiLCJEZWZhdWx0TW9uZ29VUkkiLCJjb2xsZWN0aW9uUHJlZml4IiwibW9uZ29PcHRpb25zIiwiX3VyaSIsIl9tb25nb09wdGlvbnMiLCJ1c2VOZXdVcmxQYXJzZXIiLCJ1c2VVbmlmaWVkVG9wb2xvZ3kiLCJfb25jaGFuZ2UiLCJfbWF4VGltZU1TIiwibWF4VGltZU1TIiwiY2FuU29ydE9uSm9pblRhYmxlcyIsImVuYWJsZVNjaGVtYUhvb2tzIiwic2NoZW1hQ2FjaGVUdGwiLCJrZXkiLCJ3YXRjaCIsImNhbGxiYWNrIiwiY29ubmVjdGlvblByb21pc2UiLCJlbmNvZGVkVXJpIiwiZm9ybWF0VXJsIiwicGFyc2VVcmwiLCJjbGllbnQiLCJvcHRpb25zIiwicyIsImRiIiwiZGJOYW1lIiwib24iLCJjYXRjaCIsImVyciIsIlByb21pc2UiLCJyZWplY3QiLCJoYW5kbGVFcnJvciIsImVycm9yIiwiY29kZSIsImxvZ2dlciIsImhhbmRsZVNodXRkb3duIiwiY2xvc2UiLCJfYWRhcHRpdmVDb2xsZWN0aW9uIiwibmFtZSIsInJhd0NvbGxlY3Rpb24iLCJNb25nb0NvbGxlY3Rpb24iLCJfc2NoZW1hQ29sbGVjdGlvbiIsIl9zdHJlYW0iLCJfbW9uZ29Db2xsZWN0aW9uIiwiY2xhc3NFeGlzdHMiLCJsaXN0Q29sbGVjdGlvbnMiLCJ0b0FycmF5Iiwic2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zIiwiQ0xQcyIsInNjaGVtYUNvbGxlY3Rpb24iLCJ1cGRhdGVTY2hlbWEiLCIkc2V0Iiwic2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQiLCJzdWJtaXR0ZWRJbmRleGVzIiwiZXhpc3RpbmdJbmRleGVzIiwicmVzb2x2ZSIsIl9pZF8iLCJkZWxldGVQcm9taXNlcyIsImluc2VydGVkSW5kZXhlcyIsImZvckVhY2giLCJmaWVsZCIsIl9fb3AiLCJwcm9taXNlIiwiZHJvcEluZGV4IiwicHVzaCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsInJlcGxhY2UiLCJpbnNlcnRQcm9taXNlIiwiY3JlYXRlSW5kZXhlcyIsImFsbCIsInNldEluZGV4ZXNGcm9tTW9uZ28iLCJnZXRJbmRleGVzIiwicmVkdWNlIiwib2JqIiwiaW5kZXgiLCJfZnRzIiwiX2Z0c3giLCJ3ZWlnaHRzIiwiY3JlYXRlQ2xhc3MiLCJpbnNlcnRTY2hlbWEiLCJ1cGRhdGVGaWVsZE9wdGlvbnMiLCJhZGRGaWVsZElmTm90RXhpc3RzIiwiY3JlYXRlSW5kZXhlc0lmTmVlZGVkIiwiZGVsZXRlQ2xhc3MiLCJkcm9wIiwibWVzc2FnZSIsImZpbmRBbmREZWxldGVTY2hlbWEiLCJkZWxldGVBbGxDbGFzc2VzIiwiZmFzdCIsIm1hcCIsImRlbGV0ZU1hbnkiLCJkZWxldGVGaWVsZHMiLCJmaWVsZE5hbWVzIiwibW9uZ29Gb3JtYXROYW1lcyIsImNvbGxlY3Rpb25VcGRhdGUiLCIkdW5zZXQiLCJjb2xsZWN0aW9uRmlsdGVyIiwiJG9yIiwiJGV4aXN0cyIsInNjaGVtYVVwZGF0ZSIsInVwZGF0ZU1hbnkiLCJnZXRBbGxDbGFzc2VzIiwic2NoZW1hc0NvbGxlY3Rpb24iLCJfZmV0Y2hBbGxTY2hlbWFzRnJvbV9TQ0hFTUEiLCJnZXRDbGFzcyIsIl9mZXRjaE9uZVNjaGVtYUZyb21fU0NIRU1BIiwiY3JlYXRlT2JqZWN0Iiwib2JqZWN0IiwidHJhbnNhY3Rpb25hbFNlc3Npb24iLCJwYXJzZU9iamVjdFRvTW9uZ29PYmplY3RGb3JDcmVhdGUiLCJpbnNlcnRPbmUiLCJvcHMiLCJEVVBMSUNBVEVfVkFMVUUiLCJ1bmRlcmx5aW5nRXJyb3IiLCJtYXRjaGVzIiwiQXJyYXkiLCJpc0FycmF5IiwidXNlckluZm8iLCJkdXBsaWNhdGVkX2ZpZWxkIiwiZGVsZXRlT2JqZWN0c0J5UXVlcnkiLCJxdWVyeSIsIm1vbmdvV2hlcmUiLCJ0cmFuc2Zvcm1XaGVyZSIsImRlbGV0ZWRDb3VudCIsIk9CSkVDVF9OT1RfRk9VTkQiLCJJTlRFUk5BTF9TRVJWRVJfRVJST1IiLCJ1cGRhdGVPYmplY3RzQnlRdWVyeSIsInVwZGF0ZSIsIm1vbmdvVXBkYXRlIiwidHJhbnNmb3JtVXBkYXRlIiwiZmluZE9uZUFuZFVwZGF0ZSIsInJldHVybkRvY3VtZW50Iiwic2Vzc2lvbiIsInJlc3VsdCIsIm1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdCIsInZhbHVlIiwidXBzZXJ0T25lT2JqZWN0IiwidXBzZXJ0T25lIiwiZmluZCIsInNraXAiLCJsaW1pdCIsInNvcnQiLCJyZWFkUHJlZmVyZW5jZSIsImhpbnQiLCJjYXNlSW5zZW5zaXRpdmUiLCJtb25nb1NvcnQiLCJfIiwibWFwS2V5cyIsInRyYW5zZm9ybUtleSIsIm1vbmdvS2V5cyIsIm1lbW8iLCJfcGFyc2VSZWFkUHJlZmVyZW5jZSIsImNyZWF0ZVRleHRJbmRleGVzSWZOZWVkZWQiLCJvYmplY3RzIiwiZW5zdXJlSW5kZXgiLCJpbmRleE5hbWUiLCJpbmRleENyZWF0aW9uUmVxdWVzdCIsIm1vbmdvRmllbGROYW1lcyIsImluZGV4VHlwZSIsImRlZmF1bHRPcHRpb25zIiwiYmFja2dyb3VuZCIsInNwYXJzZSIsImluZGV4TmFtZU9wdGlvbnMiLCJ0dGxPcHRpb25zIiwidHRsIiwiZXhwaXJlQWZ0ZXJTZWNvbmRzIiwiY2FzZUluc2Vuc2l0aXZlT3B0aW9ucyIsImNvbGxhdGlvbiIsImNhc2VJbnNlbnNpdGl2ZUNvbGxhdGlvbiIsImluZGV4T3B0aW9ucyIsImNyZWF0ZUluZGV4IiwiZW5zdXJlVW5pcXVlbmVzcyIsIl9lbnN1cmVTcGFyc2VVbmlxdWVJbmRleEluQmFja2dyb3VuZCIsIl9yYXdGaW5kIiwiY291bnQiLCJkaXN0aW5jdCIsImlzUG9pbnRlckZpZWxkIiwidHJhbnNmb3JtRmllbGQiLCJ0cmFuc2Zvcm1Qb2ludGVyU3RyaW5nIiwiYWdncmVnYXRlIiwicGlwZWxpbmUiLCJzdGFnZSIsIiRncm91cCIsIl9wYXJzZUFnZ3JlZ2F0ZUdyb3VwQXJncyIsIiRtYXRjaCIsIl9wYXJzZUFnZ3JlZ2F0ZUFyZ3MiLCIkcHJvamVjdCIsIl9wYXJzZUFnZ3JlZ2F0ZVByb2plY3RBcmdzIiwiJGdlb05lYXIiLCJyZXN1bHRzIiwic3BsaXQiLCJpc0VtcHR5IiwicmV0dXJuVmFsdWUiLCJfY29udmVydFRvRGF0ZSIsInN1YnN0cmluZyIsIkRhdGUiLCJ0b1VwcGVyQ2FzZSIsIlBSSU1BUlkiLCJQUklNQVJZX1BSRUZFUlJFRCIsIlNFQ09OREFSWSIsIlNFQ09OREFSWV9QUkVGRVJSRUQiLCJORUFSRVNUIiwicGVyZm9ybUluaXRpYWxpemF0aW9uIiwiJHRleHQiLCJ0ZXh0SW5kZXgiLCJkcm9wQWxsSW5kZXhlcyIsImRyb3BJbmRleGVzIiwidXBkYXRlU2NoZW1hV2l0aEluZGV4ZXMiLCJjbGFzc2VzIiwicHJvbWlzZXMiLCJjcmVhdGVUcmFuc2FjdGlvbmFsU2Vzc2lvbiIsInRyYW5zYWN0aW9uYWxTZWN0aW9uIiwic3RhcnRTZXNzaW9uIiwic3RhcnRUcmFuc2FjdGlvbiIsImNvbW1pdFRyYW5zYWN0aW9uYWxTZXNzaW9uIiwiY29tbWl0IiwicmV0cmllcyIsImNvbW1pdFRyYW5zYWN0aW9uIiwiaGFzRXJyb3JMYWJlbCIsImVuZFNlc3Npb24iLCJhYm9ydFRyYW5zYWN0aW9uYWxTZXNzaW9uIiwiYWJvcnRUcmFuc2FjdGlvbiJdLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9BZGFwdGVycy9TdG9yYWdlL01vbmdvL01vbmdvU3RvcmFnZUFkYXB0ZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQGZsb3dcbmltcG9ydCBNb25nb0NvbGxlY3Rpb24gZnJvbSAnLi9Nb25nb0NvbGxlY3Rpb24nO1xuaW1wb3J0IE1vbmdvU2NoZW1hQ29sbGVjdGlvbiBmcm9tICcuL01vbmdvU2NoZW1hQ29sbGVjdGlvbic7XG5pbXBvcnQgeyBTdG9yYWdlQWRhcHRlciB9IGZyb20gJy4uL1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCB0eXBlIHsgU2NoZW1hVHlwZSwgUXVlcnlUeXBlLCBTdG9yYWdlQ2xhc3MsIFF1ZXJ5T3B0aW9ucyB9IGZyb20gJy4uL1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCB7IHBhcnNlIGFzIHBhcnNlVXJsLCBmb3JtYXQgYXMgZm9ybWF0VXJsIH0gZnJvbSAnLi4vLi4vLi4vdmVuZG9yL21vbmdvZGJVcmwnO1xuaW1wb3J0IHtcbiAgcGFyc2VPYmplY3RUb01vbmdvT2JqZWN0Rm9yQ3JlYXRlLFxuICBtb25nb09iamVjdFRvUGFyc2VPYmplY3QsXG4gIHRyYW5zZm9ybUtleSxcbiAgdHJhbnNmb3JtV2hlcmUsXG4gIHRyYW5zZm9ybVVwZGF0ZSxcbiAgdHJhbnNmb3JtUG9pbnRlclN0cmluZyxcbn0gZnJvbSAnLi9Nb25nb1RyYW5zZm9ybSc7XG4vLyBAZmxvdy1kaXNhYmxlLW5leHRcbmltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJztcbmltcG9ydCBkZWZhdWx0cyBmcm9tICcuLi8uLi8uLi9kZWZhdWx0cyc7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uLy4uLy4uL2xvZ2dlcic7XG5cbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuY29uc3QgbW9uZ29kYiA9IHJlcXVpcmUoJ21vbmdvZGInKTtcbmNvbnN0IE1vbmdvQ2xpZW50ID0gbW9uZ29kYi5Nb25nb0NsaWVudDtcbmNvbnN0IFJlYWRQcmVmZXJlbmNlID0gbW9uZ29kYi5SZWFkUHJlZmVyZW5jZTtcblxuY29uc3QgTW9uZ29TY2hlbWFDb2xsZWN0aW9uTmFtZSA9ICdfU0NIRU1BJztcblxuY29uc3Qgc3RvcmFnZUFkYXB0ZXJBbGxDb2xsZWN0aW9ucyA9IG1vbmdvQWRhcHRlciA9PiB7XG4gIHJldHVybiBtb25nb0FkYXB0ZXJcbiAgICAuY29ubmVjdCgpXG4gICAgLnRoZW4oKCkgPT4gbW9uZ29BZGFwdGVyLmRhdGFiYXNlLmNvbGxlY3Rpb25zKCkpXG4gICAgLnRoZW4oY29sbGVjdGlvbnMgPT4ge1xuICAgICAgcmV0dXJuIGNvbGxlY3Rpb25zLmZpbHRlcihjb2xsZWN0aW9uID0+IHtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb24ubmFtZXNwYWNlLm1hdGNoKC9cXC5zeXN0ZW1cXC4vKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUT0RPOiBJZiB5b3UgaGF2ZSBvbmUgYXBwIHdpdGggYSBjb2xsZWN0aW9uIHByZWZpeCB0aGF0IGhhcHBlbnMgdG8gYmUgYSBwcmVmaXggb2YgYW5vdGhlclxuICAgICAgICAvLyBhcHBzIHByZWZpeCwgdGhpcyB3aWxsIGdvIHZlcnkgdmVyeSBiYWRseS4gV2Ugc2hvdWxkIGZpeCB0aGF0IHNvbWVob3cuXG4gICAgICAgIHJldHVybiBjb2xsZWN0aW9uLmNvbGxlY3Rpb25OYW1lLmluZGV4T2YobW9uZ29BZGFwdGVyLl9jb2xsZWN0aW9uUHJlZml4KSA9PSAwO1xuICAgICAgfSk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hID0gKHsgLi4uc2NoZW1hIH0pID0+IHtcbiAgZGVsZXRlIHNjaGVtYS5maWVsZHMuX3JwZXJtO1xuICBkZWxldGUgc2NoZW1hLmZpZWxkcy5fd3Blcm07XG5cbiAgaWYgKHNjaGVtYS5jbGFzc05hbWUgPT09ICdfVXNlcicpIHtcbiAgICAvLyBMZWdhY3kgbW9uZ28gYWRhcHRlciBrbm93cyBhYm91dCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIHBhc3N3b3JkIGFuZCBfaGFzaGVkX3Bhc3N3b3JkLlxuICAgIC8vIEZ1dHVyZSBkYXRhYmFzZSBhZGFwdGVycyB3aWxsIG9ubHkga25vdyBhYm91dCBfaGFzaGVkX3Bhc3N3b3JkLlxuICAgIC8vIE5vdGU6IFBhcnNlIFNlcnZlciB3aWxsIGJyaW5nIGJhY2sgcGFzc3dvcmQgd2l0aCBpbmplY3REZWZhdWx0U2NoZW1hLCBzbyB3ZSBkb24ndCBuZWVkXG4gICAgLy8gdG8gYWRkIF9oYXNoZWRfcGFzc3dvcmQgYmFjayBldmVyLlxuICAgIGRlbGV0ZSBzY2hlbWEuZmllbGRzLl9oYXNoZWRfcGFzc3dvcmQ7XG4gIH1cblxuICByZXR1cm4gc2NoZW1hO1xufTtcblxuLy8gUmV0dXJucyB7IGNvZGUsIGVycm9yIH0gaWYgaW52YWxpZCwgb3IgeyByZXN1bHQgfSwgYW4gb2JqZWN0XG4vLyBzdWl0YWJsZSBmb3IgaW5zZXJ0aW5nIGludG8gX1NDSEVNQSBjb2xsZWN0aW9uLCBvdGhlcndpc2UuXG5jb25zdCBtb25nb1NjaGVtYUZyb21GaWVsZHNBbmRDbGFzc05hbWVBbmRDTFAgPSAoXG4gIGZpZWxkcyxcbiAgY2xhc3NOYW1lLFxuICBjbGFzc0xldmVsUGVybWlzc2lvbnMsXG4gIGluZGV4ZXNcbikgPT4ge1xuICBjb25zdCBtb25nb09iamVjdCA9IHtcbiAgICBfaWQ6IGNsYXNzTmFtZSxcbiAgICBvYmplY3RJZDogJ3N0cmluZycsXG4gICAgdXBkYXRlZEF0OiAnc3RyaW5nJyxcbiAgICBjcmVhdGVkQXQ6ICdzdHJpbmcnLFxuICAgIF9tZXRhZGF0YTogdW5kZWZpbmVkLFxuICB9O1xuXG4gIGZvciAoY29uc3QgZmllbGROYW1lIGluIGZpZWxkcykge1xuICAgIGNvbnN0IHsgdHlwZSwgdGFyZ2V0Q2xhc3MsIC4uLmZpZWxkT3B0aW9ucyB9ID0gZmllbGRzW2ZpZWxkTmFtZV07XG4gICAgbW9uZ29PYmplY3RbZmllbGROYW1lXSA9IE1vbmdvU2NoZW1hQ29sbGVjdGlvbi5wYXJzZUZpZWxkVHlwZVRvTW9uZ29GaWVsZFR5cGUoe1xuICAgICAgdHlwZSxcbiAgICAgIHRhcmdldENsYXNzLFxuICAgIH0pO1xuICAgIGlmIChmaWVsZE9wdGlvbnMgJiYgT2JqZWN0LmtleXMoZmllbGRPcHRpb25zKS5sZW5ndGggPiAwKSB7XG4gICAgICBtb25nb09iamVjdC5fbWV0YWRhdGEgPSBtb25nb09iamVjdC5fbWV0YWRhdGEgfHwge307XG4gICAgICBtb25nb09iamVjdC5fbWV0YWRhdGEuZmllbGRzX29wdGlvbnMgPSBtb25nb09iamVjdC5fbWV0YWRhdGEuZmllbGRzX29wdGlvbnMgfHwge307XG4gICAgICBtb25nb09iamVjdC5fbWV0YWRhdGEuZmllbGRzX29wdGlvbnNbZmllbGROYW1lXSA9IGZpZWxkT3B0aW9ucztcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGNsYXNzTGV2ZWxQZXJtaXNzaW9ucyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBtb25nb09iamVjdC5fbWV0YWRhdGEgPSBtb25nb09iamVjdC5fbWV0YWRhdGEgfHwge307XG4gICAgaWYgKCFjbGFzc0xldmVsUGVybWlzc2lvbnMpIHtcbiAgICAgIGRlbGV0ZSBtb25nb09iamVjdC5fbWV0YWRhdGEuY2xhc3NfcGVybWlzc2lvbnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YS5jbGFzc19wZXJtaXNzaW9ucyA9IGNsYXNzTGV2ZWxQZXJtaXNzaW9ucztcbiAgICB9XG4gIH1cblxuICBpZiAoaW5kZXhlcyAmJiB0eXBlb2YgaW5kZXhlcyA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXMoaW5kZXhlcykubGVuZ3RoID4gMCkge1xuICAgIG1vbmdvT2JqZWN0Ll9tZXRhZGF0YSA9IG1vbmdvT2JqZWN0Ll9tZXRhZGF0YSB8fCB7fTtcbiAgICBtb25nb09iamVjdC5fbWV0YWRhdGEuaW5kZXhlcyA9IGluZGV4ZXM7XG4gIH1cblxuICBpZiAoIW1vbmdvT2JqZWN0Ll9tZXRhZGF0YSkge1xuICAgIC8vIGNsZWFudXAgdGhlIHVudXNlZCBfbWV0YWRhdGFcbiAgICBkZWxldGUgbW9uZ29PYmplY3QuX21ldGFkYXRhO1xuICB9XG5cbiAgcmV0dXJuIG1vbmdvT2JqZWN0O1xufTtcblxuZnVuY3Rpb24gdmFsaWRhdGVFeHBsYWluVmFsdWUoZXhwbGFpbikge1xuICBpZiAoZXhwbGFpbikge1xuICAgIC8vIFRoZSBsaXN0IG9mIGFsbG93ZWQgZXhwbGFpbiB2YWx1ZXMgaXMgZnJvbSBub2RlLW1vbmdvZGItbmF0aXZlL2xpYi9leHBsYWluLmpzXG4gICAgY29uc3QgZXhwbGFpbkFsbG93ZWRWYWx1ZXMgPSBbXG4gICAgICAncXVlcnlQbGFubmVyJyxcbiAgICAgICdxdWVyeVBsYW5uZXJFeHRlbmRlZCcsXG4gICAgICAnZXhlY3V0aW9uU3RhdHMnLFxuICAgICAgJ2FsbFBsYW5zRXhlY3V0aW9uJyxcbiAgICAgIGZhbHNlLFxuICAgICAgdHJ1ZSxcbiAgICBdO1xuICAgIGlmICghZXhwbGFpbkFsbG93ZWRWYWx1ZXMuaW5jbHVkZXMoZXhwbGFpbikpIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLCAnSW52YWxpZCB2YWx1ZSBmb3IgZXhwbGFpbicpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTW9uZ29TdG9yYWdlQWRhcHRlciBpbXBsZW1lbnRzIFN0b3JhZ2VBZGFwdGVyIHtcbiAgLy8gUHJpdmF0ZVxuICBfdXJpOiBzdHJpbmc7XG4gIF9jb2xsZWN0aW9uUHJlZml4OiBzdHJpbmc7XG4gIF9tb25nb09wdGlvbnM6IE9iamVjdDtcbiAgX29uY2hhbmdlOiBhbnk7XG4gIF9zdHJlYW06IGFueTtcbiAgLy8gUHVibGljXG4gIGNvbm5lY3Rpb25Qcm9taXNlOiA/UHJvbWlzZTxhbnk+O1xuICBkYXRhYmFzZTogYW55O1xuICBjbGllbnQ6IE1vbmdvQ2xpZW50O1xuICBfbWF4VGltZU1TOiA/bnVtYmVyO1xuICBjYW5Tb3J0T25Kb2luVGFibGVzOiBib29sZWFuO1xuICBlbmFibGVTY2hlbWFIb29rczogYm9vbGVhbjtcbiAgc2NoZW1hQ2FjaGVUdGw6ID9udW1iZXI7XG5cbiAgY29uc3RydWN0b3IoeyB1cmkgPSBkZWZhdWx0cy5EZWZhdWx0TW9uZ29VUkksIGNvbGxlY3Rpb25QcmVmaXggPSAnJywgbW9uZ29PcHRpb25zID0ge30gfTogYW55KSB7XG4gICAgdGhpcy5fdXJpID0gdXJpO1xuICAgIHRoaXMuX2NvbGxlY3Rpb25QcmVmaXggPSBjb2xsZWN0aW9uUHJlZml4O1xuICAgIHRoaXMuX21vbmdvT3B0aW9ucyA9IHsgLi4ubW9uZ29PcHRpb25zIH07XG4gICAgdGhpcy5fbW9uZ29PcHRpb25zLnVzZU5ld1VybFBhcnNlciA9IHRydWU7XG4gICAgdGhpcy5fbW9uZ29PcHRpb25zLnVzZVVuaWZpZWRUb3BvbG9neSA9IHRydWU7XG4gICAgdGhpcy5fb25jaGFuZ2UgPSAoKSA9PiB7fTtcblxuICAgIC8vIE1heFRpbWVNUyBpcyBub3QgYSBnbG9iYWwgTW9uZ29EQiBjbGllbnQgb3B0aW9uLCBpdCBpcyBhcHBsaWVkIHBlciBvcGVyYXRpb24uXG4gICAgdGhpcy5fbWF4VGltZU1TID0gbW9uZ29PcHRpb25zLm1heFRpbWVNUztcbiAgICB0aGlzLmNhblNvcnRPbkpvaW5UYWJsZXMgPSB0cnVlO1xuICAgIHRoaXMuZW5hYmxlU2NoZW1hSG9va3MgPSAhIW1vbmdvT3B0aW9ucy5lbmFibGVTY2hlbWFIb29rcztcbiAgICB0aGlzLnNjaGVtYUNhY2hlVHRsID0gbW9uZ29PcHRpb25zLnNjaGVtYUNhY2hlVHRsO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIFsnZW5hYmxlU2NoZW1hSG9va3MnLCAnc2NoZW1hQ2FjaGVUdGwnLCAnbWF4VGltZU1TJ10pIHtcbiAgICAgIGRlbGV0ZSBtb25nb09wdGlvbnNba2V5XTtcbiAgICAgIGRlbGV0ZSB0aGlzLl9tb25nb09wdGlvbnNba2V5XTtcbiAgICB9XG4gIH1cblxuICB3YXRjaChjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuX29uY2hhbmdlID0gY2FsbGJhY2s7XG4gIH1cblxuICBjb25uZWN0KCkge1xuICAgIGlmICh0aGlzLmNvbm5lY3Rpb25Qcm9taXNlKSB7XG4gICAgICByZXR1cm4gdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICB9XG5cbiAgICAvLyBwYXJzaW5nIGFuZCByZS1mb3JtYXR0aW5nIGNhdXNlcyB0aGUgYXV0aCB2YWx1ZSAoaWYgdGhlcmUpIHRvIGdldCBVUklcbiAgICAvLyBlbmNvZGVkXG4gICAgY29uc3QgZW5jb2RlZFVyaSA9IGZvcm1hdFVybChwYXJzZVVybCh0aGlzLl91cmkpKTtcblxuICAgIHRoaXMuY29ubmVjdGlvblByb21pc2UgPSBNb25nb0NsaWVudC5jb25uZWN0KGVuY29kZWRVcmksIHRoaXMuX21vbmdvT3B0aW9ucylcbiAgICAgIC50aGVuKGNsaWVudCA9PiB7XG4gICAgICAgIC8vIFN0YXJ0aW5nIG1vbmdvREIgMy4wLCB0aGUgTW9uZ29DbGllbnQuY29ubmVjdCBkb24ndCByZXR1cm4gYSBEQiBhbnltb3JlIGJ1dCBhIGNsaWVudFxuICAgICAgICAvLyBGb3J0dW5hdGVseSwgd2UgY2FuIGdldCBiYWNrIHRoZSBvcHRpb25zIGFuZCB1c2UgdGhlbSB0byBzZWxlY3QgdGhlIHByb3BlciBEQi5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21vbmdvZGIvbm9kZS1tb25nb2RiLW5hdGl2ZS9ibG9iLzJjMzVkNzZmMDg1NzQyMjViOGRiMDJkN2JlZjY4NzEyM2U2YmIwMTgvbGliL21vbmdvX2NsaWVudC5qcyNMODg1XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSBjbGllbnQucy5vcHRpb25zO1xuICAgICAgICBjb25zdCBkYXRhYmFzZSA9IGNsaWVudC5kYihvcHRpb25zLmRiTmFtZSk7XG4gICAgICAgIGlmICghZGF0YWJhc2UpIHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY2xpZW50Lm9uKCdlcnJvcicsICgpID0+IHtcbiAgICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNsaWVudC5vbignY2xvc2UnLCAoKSA9PiB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvblByb21pc2U7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcbiAgICAgICAgdGhpcy5kYXRhYmFzZSA9IGRhdGFiYXNlO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLmNvbm5lY3Rpb25Qcm9taXNlO1xuICB9XG5cbiAgaGFuZGxlRXJyb3I8VD4oZXJyb3I6ID8oRXJyb3IgfCBQYXJzZS5FcnJvcikpOiBQcm9taXNlPFQ+IHtcbiAgICBpZiAoZXJyb3IgJiYgZXJyb3IuY29kZSA9PT0gMTMpIHtcbiAgICAgIC8vIFVuYXV0aG9yaXplZCBlcnJvclxuICAgICAgZGVsZXRlIHRoaXMuY2xpZW50O1xuICAgICAgZGVsZXRlIHRoaXMuZGF0YWJhc2U7XG4gICAgICBkZWxldGUgdGhpcy5jb25uZWN0aW9uUHJvbWlzZTtcbiAgICAgIGxvZ2dlci5lcnJvcignUmVjZWl2ZWQgdW5hdXRob3JpemVkIGVycm9yJywgeyBlcnJvcjogZXJyb3IgfSk7XG4gICAgfVxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgYXN5bmMgaGFuZGxlU2h1dGRvd24oKSB7XG4gICAgaWYgKCF0aGlzLmNsaWVudCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhd2FpdCB0aGlzLmNsaWVudC5jbG9zZShmYWxzZSk7XG4gICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvblByb21pc2U7XG4gIH1cblxuICBfYWRhcHRpdmVDb2xsZWN0aW9uKG5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmNvbm5lY3QoKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5kYXRhYmFzZS5jb2xsZWN0aW9uKHRoaXMuX2NvbGxlY3Rpb25QcmVmaXggKyBuYW1lKSlcbiAgICAgIC50aGVuKHJhd0NvbGxlY3Rpb24gPT4gbmV3IE1vbmdvQ29sbGVjdGlvbihyYXdDb2xsZWN0aW9uKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIF9zY2hlbWFDb2xsZWN0aW9uKCk6IFByb21pc2U8TW9uZ29TY2hlbWFDb2xsZWN0aW9uPiB7XG4gICAgcmV0dXJuIHRoaXMuY29ubmVjdCgpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oTW9uZ29TY2hlbWFDb2xsZWN0aW9uTmFtZSkpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IHtcbiAgICAgICAgaWYgKCF0aGlzLl9zdHJlYW0gJiYgdGhpcy5lbmFibGVTY2hlbWFIb29rcykge1xuICAgICAgICAgIHRoaXMuX3N0cmVhbSA9IGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi53YXRjaCgpO1xuICAgICAgICAgIHRoaXMuX3N0cmVhbS5vbignY2hhbmdlJywgKCkgPT4gdGhpcy5fb25jaGFuZ2UoKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBNb25nb1NjaGVtYUNvbGxlY3Rpb24oY29sbGVjdGlvbik7XG4gICAgICB9KTtcbiAgfVxuXG4gIGNsYXNzRXhpc3RzKG5hbWU6IHN0cmluZykge1xuICAgIHJldHVybiB0aGlzLmNvbm5lY3QoKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhYmFzZS5saXN0Q29sbGVjdGlvbnMoeyBuYW1lOiB0aGlzLl9jb2xsZWN0aW9uUHJlZml4ICsgbmFtZSB9KS50b0FycmF5KCk7XG4gICAgICB9KVxuICAgICAgLnRoZW4oY29sbGVjdGlvbnMgPT4ge1xuICAgICAgICByZXR1cm4gY29sbGVjdGlvbnMubGVuZ3RoID4gMDtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBzZXRDbGFzc0xldmVsUGVybWlzc2lvbnMoY2xhc3NOYW1lOiBzdHJpbmcsIENMUHM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiB0aGlzLl9zY2hlbWFDb2xsZWN0aW9uKClcbiAgICAgIC50aGVuKHNjaGVtYUNvbGxlY3Rpb24gPT5cbiAgICAgICAgc2NoZW1hQ29sbGVjdGlvbi51cGRhdGVTY2hlbWEoY2xhc3NOYW1lLCB7XG4gICAgICAgICAgJHNldDogeyAnX21ldGFkYXRhLmNsYXNzX3Blcm1pc3Npb25zJzogQ0xQcyB9LFxuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgc2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc3VibWl0dGVkSW5kZXhlczogYW55LFxuICAgIGV4aXN0aW5nSW5kZXhlczogYW55ID0ge30sXG4gICAgZmllbGRzOiBhbnlcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHN1Ym1pdHRlZEluZGV4ZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXMoZXhpc3RpbmdJbmRleGVzKS5sZW5ndGggPT09IDApIHtcbiAgICAgIGV4aXN0aW5nSW5kZXhlcyA9IHsgX2lkXzogeyBfaWQ6IDEgfSB9O1xuICAgIH1cbiAgICBjb25zdCBkZWxldGVQcm9taXNlcyA9IFtdO1xuICAgIGNvbnN0IGluc2VydGVkSW5kZXhlcyA9IFtdO1xuICAgIE9iamVjdC5rZXlzKHN1Ym1pdHRlZEluZGV4ZXMpLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb25zdCBmaWVsZCA9IHN1Ym1pdHRlZEluZGV4ZXNbbmFtZV07XG4gICAgICBpZiAoZXhpc3RpbmdJbmRleGVzW25hbWVdICYmIGZpZWxkLl9fb3AgIT09ICdEZWxldGUnKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLCBgSW5kZXggJHtuYW1lfSBleGlzdHMsIGNhbm5vdCB1cGRhdGUuYCk7XG4gICAgICB9XG4gICAgICBpZiAoIWV4aXN0aW5nSW5kZXhlc1tuYW1lXSAmJiBmaWVsZC5fX29wID09PSAnRGVsZXRlJykge1xuICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9RVUVSWSxcbiAgICAgICAgICBgSW5kZXggJHtuYW1lfSBkb2VzIG5vdCBleGlzdCwgY2Fubm90IGRlbGV0ZS5gXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoZmllbGQuX19vcCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuZHJvcEluZGV4KGNsYXNzTmFtZSwgbmFtZSk7XG4gICAgICAgIGRlbGV0ZVByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIGRlbGV0ZSBleGlzdGluZ0luZGV4ZXNbbmFtZV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBPYmplY3Qua2V5cyhmaWVsZCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoXG4gICAgICAgICAgICAgIGZpZWxkcyxcbiAgICAgICAgICAgICAga2V5LmluZGV4T2YoJ19wXycpID09PSAwID8ga2V5LnJlcGxhY2UoJ19wXycsICcnKSA6IGtleVxuICAgICAgICAgICAgKVxuICAgICAgICAgICkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLFxuICAgICAgICAgICAgICBgRmllbGQgJHtrZXl9IGRvZXMgbm90IGV4aXN0LCBjYW5ub3QgYWRkIGluZGV4LmBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgZXhpc3RpbmdJbmRleGVzW25hbWVdID0gZmllbGQ7XG4gICAgICAgIGluc2VydGVkSW5kZXhlcy5wdXNoKHtcbiAgICAgICAgICBrZXk6IGZpZWxkLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICAgIGxldCBpbnNlcnRQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgaWYgKGluc2VydGVkSW5kZXhlcy5sZW5ndGggPiAwKSB7XG4gICAgICBpbnNlcnRQcm9taXNlID0gdGhpcy5jcmVhdGVJbmRleGVzKGNsYXNzTmFtZSwgaW5zZXJ0ZWRJbmRleGVzKTtcbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKGRlbGV0ZVByb21pc2VzKVxuICAgICAgLnRoZW4oKCkgPT4gaW5zZXJ0UHJvbWlzZSlcbiAgICAgIC50aGVuKCgpID0+IHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKSlcbiAgICAgIC50aGVuKHNjaGVtYUNvbGxlY3Rpb24gPT5cbiAgICAgICAgc2NoZW1hQ29sbGVjdGlvbi51cGRhdGVTY2hlbWEoY2xhc3NOYW1lLCB7XG4gICAgICAgICAgJHNldDogeyAnX21ldGFkYXRhLmluZGV4ZXMnOiBleGlzdGluZ0luZGV4ZXMgfSxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIHNldEluZGV4ZXNGcm9tTW9uZ28oY2xhc3NOYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5nZXRJbmRleGVzKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGluZGV4ZXMgPT4ge1xuICAgICAgICBpbmRleGVzID0gaW5kZXhlcy5yZWR1Y2UoKG9iaiwgaW5kZXgpID0+IHtcbiAgICAgICAgICBpZiAoaW5kZXgua2V5Ll9mdHMpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBpbmRleC5rZXkuX2Z0cztcbiAgICAgICAgICAgIGRlbGV0ZSBpbmRleC5rZXkuX2Z0c3g7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpZWxkIGluIGluZGV4LndlaWdodHMpIHtcbiAgICAgICAgICAgICAgaW5kZXgua2V5W2ZpZWxkXSA9ICd0ZXh0JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgb2JqW2luZGV4Lm5hbWVdID0gaW5kZXgua2V5O1xuICAgICAgICAgIHJldHVybiBvYmo7XG4gICAgICAgIH0sIHt9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKS50aGVuKHNjaGVtYUNvbGxlY3Rpb24gPT5cbiAgICAgICAgICBzY2hlbWFDb2xsZWN0aW9uLnVwZGF0ZVNjaGVtYShjbGFzc05hbWUsIHtcbiAgICAgICAgICAgICRzZXQ6IHsgJ19tZXRhZGF0YS5pbmRleGVzJzogaW5kZXhlcyB9LFxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpXG4gICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgICAvLyBJZ25vcmUgaWYgY29sbGVjdGlvbiBub3QgZm91bmRcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gIH1cblxuICBjcmVhdGVDbGFzcyhjbGFzc05hbWU6IHN0cmluZywgc2NoZW1hOiBTY2hlbWFUeXBlKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvT2JqZWN0ID0gbW9uZ29TY2hlbWFGcm9tRmllbGRzQW5kQ2xhc3NOYW1lQW5kQ0xQKFxuICAgICAgc2NoZW1hLmZpZWxkcyxcbiAgICAgIGNsYXNzTmFtZSxcbiAgICAgIHNjaGVtYS5jbGFzc0xldmVsUGVybWlzc2lvbnMsXG4gICAgICBzY2hlbWEuaW5kZXhlc1xuICAgICk7XG4gICAgbW9uZ29PYmplY3QuX2lkID0gY2xhc3NOYW1lO1xuICAgIHJldHVybiB0aGlzLnNldEluZGV4ZXNXaXRoU2NoZW1hRm9ybWF0KGNsYXNzTmFtZSwgc2NoZW1hLmluZGV4ZXMsIHt9LCBzY2hlbWEuZmllbGRzKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpKVxuICAgICAgLnRoZW4oc2NoZW1hQ29sbGVjdGlvbiA9PiBzY2hlbWFDb2xsZWN0aW9uLmluc2VydFNjaGVtYShtb25nb09iamVjdCkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBhc3luYyB1cGRhdGVGaWVsZE9wdGlvbnMoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nLCB0eXBlOiBhbnkpIHtcbiAgICBjb25zdCBzY2hlbWFDb2xsZWN0aW9uID0gYXdhaXQgdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpO1xuICAgIGF3YWl0IHNjaGVtYUNvbGxlY3Rpb24udXBkYXRlRmllbGRPcHRpb25zKGNsYXNzTmFtZSwgZmllbGROYW1lLCB0eXBlKTtcbiAgfVxuXG4gIGFkZEZpZWxkSWZOb3RFeGlzdHMoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nLCB0eXBlOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpXG4gICAgICAudGhlbihzY2hlbWFDb2xsZWN0aW9uID0+IHNjaGVtYUNvbGxlY3Rpb24uYWRkRmllbGRJZk5vdEV4aXN0cyhjbGFzc05hbWUsIGZpZWxkTmFtZSwgdHlwZSkpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLmNyZWF0ZUluZGV4ZXNJZk5lZWRlZChjbGFzc05hbWUsIGZpZWxkTmFtZSwgdHlwZSkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBEcm9wcyBhIGNvbGxlY3Rpb24uIFJlc29sdmVzIHdpdGggdHJ1ZSBpZiBpdCB3YXMgYSBQYXJzZSBTY2hlbWEgKGVnLiBfVXNlciwgQ3VzdG9tLCBldGMuKVxuICAvLyBhbmQgcmVzb2x2ZXMgd2l0aCBmYWxzZSBpZiBpdCB3YXNuJ3QgKGVnLiBhIGpvaW4gdGFibGUpLiBSZWplY3RzIGlmIGRlbGV0aW9uIHdhcyBpbXBvc3NpYmxlLlxuICBkZWxldGVDbGFzcyhjbGFzc05hbWU6IHN0cmluZykge1xuICAgIHJldHVybiAoXG4gICAgICB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uZHJvcCgpKVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIC8vICducyBub3QgZm91bmQnIG1lYW5zIGNvbGxlY3Rpb24gd2FzIGFscmVhZHkgZ29uZS4gSWdub3JlIGRlbGV0aW9uIGF0dGVtcHQuXG4gICAgICAgICAgaWYgKGVycm9yLm1lc3NhZ2UgPT0gJ25zIG5vdCBmb3VuZCcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pXG4gICAgICAgIC8vIFdlJ3ZlIGRyb3BwZWQgdGhlIGNvbGxlY3Rpb24sIG5vdyByZW1vdmUgdGhlIF9TQ0hFTUEgZG9jdW1lbnRcbiAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpKVxuICAgICAgICAudGhlbihzY2hlbWFDb2xsZWN0aW9uID0+IHNjaGVtYUNvbGxlY3Rpb24uZmluZEFuZERlbGV0ZVNjaGVtYShjbGFzc05hbWUpKVxuICAgICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSlcbiAgICApO1xuICB9XG5cbiAgZGVsZXRlQWxsQ2xhc3NlcyhmYXN0OiBib29sZWFuKSB7XG4gICAgcmV0dXJuIHN0b3JhZ2VBZGFwdGVyQWxsQ29sbGVjdGlvbnModGhpcykudGhlbihjb2xsZWN0aW9ucyA9PlxuICAgICAgUHJvbWlzZS5hbGwoXG4gICAgICAgIGNvbGxlY3Rpb25zLm1hcChjb2xsZWN0aW9uID0+IChmYXN0ID8gY29sbGVjdGlvbi5kZWxldGVNYW55KHt9KSA6IGNvbGxlY3Rpb24uZHJvcCgpKSlcbiAgICAgIClcbiAgICApO1xuICB9XG5cbiAgLy8gUmVtb3ZlIHRoZSBjb2x1bW4gYW5kIGFsbCB0aGUgZGF0YS4gRm9yIFJlbGF0aW9ucywgdGhlIF9Kb2luIGNvbGxlY3Rpb24gaXMgaGFuZGxlZFxuICAvLyBzcGVjaWFsbHksIHRoaXMgZnVuY3Rpb24gZG9lcyBub3QgZGVsZXRlIF9Kb2luIGNvbHVtbnMuIEl0IHNob3VsZCwgaG93ZXZlciwgaW5kaWNhdGVcbiAgLy8gdGhhdCB0aGUgcmVsYXRpb24gZmllbGRzIGRvZXMgbm90IGV4aXN0IGFueW1vcmUuIEluIG1vbmdvLCB0aGlzIG1lYW5zIHJlbW92aW5nIGl0IGZyb21cbiAgLy8gdGhlIF9TQ0hFTUEgY29sbGVjdGlvbi4gIFRoZXJlIHNob3VsZCBiZSBubyBhY3R1YWwgZGF0YSBpbiB0aGUgY29sbGVjdGlvbiB1bmRlciB0aGUgc2FtZSBuYW1lXG4gIC8vIGFzIHRoZSByZWxhdGlvbiBjb2x1bW4sIHNvIGl0J3MgZmluZSB0byBhdHRlbXB0IHRvIGRlbGV0ZSBpdC4gSWYgdGhlIGZpZWxkcyBsaXN0ZWQgdG8gYmVcbiAgLy8gZGVsZXRlZCBkbyBub3QgZXhpc3QsIHRoaXMgZnVuY3Rpb24gc2hvdWxkIHJldHVybiBzdWNjZXNzZnVsbHkgYW55d2F5cy4gQ2hlY2tpbmcgZm9yXG4gIC8vIGF0dGVtcHRzIHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgZmllbGRzIGlzIHRoZSByZXNwb25zaWJpbGl0eSBvZiBQYXJzZSBTZXJ2ZXIuXG5cbiAgLy8gUG9pbnRlciBmaWVsZCBuYW1lcyBhcmUgcGFzc2VkIGZvciBsZWdhY3kgcmVhc29uczogdGhlIG9yaWdpbmFsIG1vbmdvXG4gIC8vIGZvcm1hdCBzdG9yZWQgcG9pbnRlciBmaWVsZCBuYW1lcyBkaWZmZXJlbnRseSBpbiB0aGUgZGF0YWJhc2UsIGFuZCB0aGVyZWZvcmVcbiAgLy8gbmVlZGVkIHRvIGtub3cgdGhlIHR5cGUgb2YgdGhlIGZpZWxkIGJlZm9yZSBpdCBjb3VsZCBkZWxldGUgaXQuIEZ1dHVyZSBkYXRhYmFzZVxuICAvLyBhZGFwdGVycyBzaG91bGQgaWdub3JlIHRoZSBwb2ludGVyRmllbGROYW1lcyBhcmd1bWVudC4gQWxsIHRoZSBmaWVsZCBuYW1lcyBhcmUgaW5cbiAgLy8gZmllbGROYW1lcywgdGhleSBzaG93IHVwIGFkZGl0aW9uYWxseSBpbiB0aGUgcG9pbnRlckZpZWxkTmFtZXMgZGF0YWJhc2UgZm9yIHVzZVxuICAvLyBieSB0aGUgbW9uZ28gYWRhcHRlciwgd2hpY2ggZGVhbHMgd2l0aCB0aGUgbGVnYWN5IG1vbmdvIGZvcm1hdC5cblxuICAvLyBUaGlzIGZ1bmN0aW9uIGlzIG5vdCBvYmxpZ2F0ZWQgdG8gZGVsZXRlIGZpZWxkcyBhdG9taWNhbGx5LiBJdCBpcyBnaXZlbiB0aGUgZmllbGRcbiAgLy8gbmFtZXMgaW4gYSBsaXN0IHNvIHRoYXQgZGF0YWJhc2VzIHRoYXQgYXJlIGNhcGFibGUgb2YgZGVsZXRpbmcgZmllbGRzIGF0b21pY2FsbHlcbiAgLy8gbWF5IGRvIHNvLlxuXG4gIC8vIFJldHVybnMgYSBQcm9taXNlLlxuICBkZWxldGVGaWVsZHMoY2xhc3NOYW1lOiBzdHJpbmcsIHNjaGVtYTogU2NoZW1hVHlwZSwgZmllbGROYW1lczogc3RyaW5nW10pIHtcbiAgICBjb25zdCBtb25nb0Zvcm1hdE5hbWVzID0gZmllbGROYW1lcy5tYXAoZmllbGROYW1lID0+IHtcbiAgICAgIGlmIChzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PT0gJ1BvaW50ZXInKSB7XG4gICAgICAgIHJldHVybiBgX3BfJHtmaWVsZE5hbWV9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmaWVsZE5hbWU7XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgY29sbGVjdGlvblVwZGF0ZSA9IHsgJHVuc2V0OiB7fSB9O1xuICAgIG1vbmdvRm9ybWF0TmFtZXMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbGxlY3Rpb25VcGRhdGVbJyR1bnNldCddW25hbWVdID0gbnVsbDtcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbGxlY3Rpb25GaWx0ZXIgPSB7ICRvcjogW10gfTtcbiAgICBtb25nb0Zvcm1hdE5hbWVzLmZvckVhY2gobmFtZSA9PiB7XG4gICAgICBjb2xsZWN0aW9uRmlsdGVyWyckb3InXS5wdXNoKHsgW25hbWVdOiB7ICRleGlzdHM6IHRydWUgfSB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHNjaGVtYVVwZGF0ZSA9IHsgJHVuc2V0OiB7fSB9O1xuICAgIGZpZWxkTmFtZXMuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIHNjaGVtYVVwZGF0ZVsnJHVuc2V0J11bbmFtZV0gPSBudWxsO1xuICAgICAgc2NoZW1hVXBkYXRlWyckdW5zZXQnXVtgX21ldGFkYXRhLmZpZWxkc19vcHRpb25zLiR7bmFtZX1gXSA9IG51bGw7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi51cGRhdGVNYW55KGNvbGxlY3Rpb25GaWx0ZXIsIGNvbGxlY3Rpb25VcGRhdGUpKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fc2NoZW1hQ29sbGVjdGlvbigpKVxuICAgICAgLnRoZW4oc2NoZW1hQ29sbGVjdGlvbiA9PiBzY2hlbWFDb2xsZWN0aW9uLnVwZGF0ZVNjaGVtYShjbGFzc05hbWUsIHNjaGVtYVVwZGF0ZSkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBSZXR1cm4gYSBwcm9taXNlIGZvciBhbGwgc2NoZW1hcyBrbm93biB0byB0aGlzIGFkYXB0ZXIsIGluIFBhcnNlIGZvcm1hdC4gSW4gY2FzZSB0aGVcbiAgLy8gc2NoZW1hcyBjYW5ub3QgYmUgcmV0cmlldmVkLCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMuIFJlcXVpcmVtZW50cyBmb3IgdGhlXG4gIC8vIHJlamVjdGlvbiByZWFzb24gYXJlIFRCRC5cbiAgZ2V0QWxsQ2xhc3NlcygpOiBQcm9taXNlPFN0b3JhZ2VDbGFzc1tdPiB7XG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKVxuICAgICAgLnRoZW4oc2NoZW1hc0NvbGxlY3Rpb24gPT4gc2NoZW1hc0NvbGxlY3Rpb24uX2ZldGNoQWxsU2NoZW1hc0Zyb21fU0NIRU1BKCkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBSZXR1cm4gYSBwcm9taXNlIGZvciB0aGUgc2NoZW1hIHdpdGggdGhlIGdpdmVuIG5hbWUsIGluIFBhcnNlIGZvcm1hdC4gSWZcbiAgLy8gdGhpcyBhZGFwdGVyIGRvZXNuJ3Qga25vdyBhYm91dCB0aGUgc2NoZW1hLCByZXR1cm4gYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aXRoXG4gIC8vIHVuZGVmaW5lZCBhcyB0aGUgcmVhc29uLlxuICBnZXRDbGFzcyhjbGFzc05hbWU6IHN0cmluZyk6IFByb21pc2U8U3RvcmFnZUNsYXNzPiB7XG4gICAgcmV0dXJuIHRoaXMuX3NjaGVtYUNvbGxlY3Rpb24oKVxuICAgICAgLnRoZW4oc2NoZW1hc0NvbGxlY3Rpb24gPT4gc2NoZW1hc0NvbGxlY3Rpb24uX2ZldGNoT25lU2NoZW1hRnJvbV9TQ0hFTUEoY2xhc3NOYW1lKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIFRPRE86IEFzIHlldCBub3QgcGFydGljdWxhcmx5IHdlbGwgc3BlY2lmaWVkLiBDcmVhdGVzIGFuIG9iamVjdC4gTWF5YmUgc2hvdWxkbid0IGV2ZW4gbmVlZCB0aGUgc2NoZW1hLFxuICAvLyBhbmQgc2hvdWxkIGluZmVyIGZyb20gdGhlIHR5cGUuIE9yIG1heWJlIGRvZXMgbmVlZCB0aGUgc2NoZW1hIGZvciB2YWxpZGF0aW9ucy4gT3IgbWF5YmUgbmVlZHNcbiAgLy8gdGhlIHNjaGVtYSBvbmx5IGZvciB0aGUgbGVnYWN5IG1vbmdvIGZvcm1hdC4gV2UnbGwgZmlndXJlIHRoYXQgb3V0IGxhdGVyLlxuICBjcmVhdGVPYmplY3QoY2xhc3NOYW1lOiBzdHJpbmcsIHNjaGVtYTogU2NoZW1hVHlwZSwgb2JqZWN0OiBhbnksIHRyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55KSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvT2JqZWN0ID0gcGFyc2VPYmplY3RUb01vbmdvT2JqZWN0Rm9yQ3JlYXRlKGNsYXNzTmFtZSwgb2JqZWN0LCBzY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiBjb2xsZWN0aW9uLmluc2VydE9uZShtb25nb09iamVjdCwgdHJhbnNhY3Rpb25hbFNlc3Npb24pKVxuICAgICAgLnRoZW4oKCkgPT4gKHsgb3BzOiBbbW9uZ29PYmplY3RdIH0pKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yLmNvZGUgPT09IDExMDAwKSB7XG4gICAgICAgICAgLy8gRHVwbGljYXRlIHZhbHVlXG4gICAgICAgICAgY29uc3QgZXJyID0gbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuRFVQTElDQVRFX1ZBTFVFLFxuICAgICAgICAgICAgJ0EgZHVwbGljYXRlIHZhbHVlIGZvciBhIGZpZWxkIHdpdGggdW5pcXVlIHZhbHVlcyB3YXMgcHJvdmlkZWQnXG4gICAgICAgICAgKTtcbiAgICAgICAgICBlcnIudW5kZXJseWluZ0Vycm9yID0gZXJyb3I7XG4gICAgICAgICAgaWYgKGVycm9yLm1lc3NhZ2UpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBlcnJvci5tZXNzYWdlLm1hdGNoKC9pbmRleDpbXFxzYS16QS1aMC05X1xcLVxcLl0rXFwkPyhbYS16QS1aXy1dKylfMS8pO1xuICAgICAgICAgICAgaWYgKG1hdGNoZXMgJiYgQXJyYXkuaXNBcnJheShtYXRjaGVzKSkge1xuICAgICAgICAgICAgICBlcnIudXNlckluZm8gPSB7IGR1cGxpY2F0ZWRfZmllbGQ6IG1hdGNoZXNbMV0gfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgb2JqZWN0cyB0aGF0IG1hdGNoIHRoZSBnaXZlbiBQYXJzZSBRdWVyeS5cbiAgLy8gSWYgbm8gb2JqZWN0cyBtYXRjaCwgcmVqZWN0IHdpdGggT0JKRUNUX05PVF9GT1VORC4gSWYgb2JqZWN0cyBhcmUgZm91bmQgYW5kIGRlbGV0ZWQsIHJlc29sdmUgd2l0aCB1bmRlZmluZWQuXG4gIC8vIElmIHRoZXJlIGlzIHNvbWUgb3RoZXIgZXJyb3IsIHJlamVjdCB3aXRoIElOVEVSTkFMX1NFUlZFUl9FUlJPUi5cbiAgZGVsZXRlT2JqZWN0c0J5UXVlcnkoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIHF1ZXJ5OiBRdWVyeVR5cGUsXG4gICAgdHJhbnNhY3Rpb25hbFNlc3Npb246ID9hbnlcbiAgKSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiB7XG4gICAgICAgIGNvbnN0IG1vbmdvV2hlcmUgPSB0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWEpO1xuICAgICAgICByZXR1cm4gY29sbGVjdGlvbi5kZWxldGVNYW55KG1vbmdvV2hlcmUsIHRyYW5zYWN0aW9uYWxTZXNzaW9uKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSlcbiAgICAgIC50aGVuKFxuICAgICAgICAoeyBkZWxldGVkQ291bnQgfSkgPT4ge1xuICAgICAgICAgIGlmIChkZWxldGVkQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5ELCAnT2JqZWN0IG5vdCBmb3VuZC4nKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9LFxuICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVEVSTkFMX1NFUlZFUl9FUlJPUiwgJ0RhdGFiYXNlIGFkYXB0ZXIgZXJyb3InKTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgfVxuXG4gIC8vIEFwcGx5IHRoZSB1cGRhdGUgdG8gYWxsIG9iamVjdHMgdGhhdCBtYXRjaCB0aGUgZ2l2ZW4gUGFyc2UgUXVlcnkuXG4gIHVwZGF0ZU9iamVjdHNCeVF1ZXJ5KFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogU2NoZW1hVHlwZSxcbiAgICBxdWVyeTogUXVlcnlUeXBlLFxuICAgIHVwZGF0ZTogYW55LFxuICAgIHRyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55XG4gICkge1xuICAgIHNjaGVtYSA9IGNvbnZlcnRQYXJzZVNjaGVtYVRvTW9uZ29TY2hlbWEoc2NoZW1hKTtcbiAgICBjb25zdCBtb25nb1VwZGF0ZSA9IHRyYW5zZm9ybVVwZGF0ZShjbGFzc05hbWUsIHVwZGF0ZSwgc2NoZW1hKTtcbiAgICBjb25zdCBtb25nb1doZXJlID0gdHJhbnNmb3JtV2hlcmUoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKTtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi51cGRhdGVNYW55KG1vbmdvV2hlcmUsIG1vbmdvVXBkYXRlLCB0cmFuc2FjdGlvbmFsU2Vzc2lvbikpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBBdG9taWNhbGx5IGZpbmRzIGFuZCB1cGRhdGVzIGFuIG9iamVjdCBiYXNlZCBvbiBxdWVyeS5cbiAgLy8gUmV0dXJuIHZhbHVlIG5vdCBjdXJyZW50bHkgd2VsbCBzcGVjaWZpZWQuXG4gIGZpbmRPbmVBbmRVcGRhdGUoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIHF1ZXJ5OiBRdWVyeVR5cGUsXG4gICAgdXBkYXRlOiBhbnksXG4gICAgdHJhbnNhY3Rpb25hbFNlc3Npb246ID9hbnlcbiAgKSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvVXBkYXRlID0gdHJhbnNmb3JtVXBkYXRlKGNsYXNzTmFtZSwgdXBkYXRlLCBzY2hlbWEpO1xuICAgIGNvbnN0IG1vbmdvV2hlcmUgPSB0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWEpO1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PlxuICAgICAgICBjb2xsZWN0aW9uLl9tb25nb0NvbGxlY3Rpb24uZmluZE9uZUFuZFVwZGF0ZShtb25nb1doZXJlLCBtb25nb1VwZGF0ZSwge1xuICAgICAgICAgIHJldHVybkRvY3VtZW50OiAnYWZ0ZXInLFxuICAgICAgICAgIHNlc3Npb246IHRyYW5zYWN0aW9uYWxTZXNzaW9uIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC50aGVuKHJlc3VsdCA9PiBtb25nb09iamVjdFRvUGFyc2VPYmplY3QoY2xhc3NOYW1lLCByZXN1bHQudmFsdWUsIHNjaGVtYSkpXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBpZiAoZXJyb3IuY29kZSA9PT0gMTEwMDApIHtcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5EVVBMSUNBVEVfVkFMVUUsXG4gICAgICAgICAgICAnQSBkdXBsaWNhdGUgdmFsdWUgZm9yIGEgZmllbGQgd2l0aCB1bmlxdWUgdmFsdWVzIHdhcyBwcm92aWRlZCdcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEhvcGVmdWxseSB3ZSBjYW4gZ2V0IHJpZCBvZiB0aGlzLiBJdCdzIG9ubHkgdXNlZCBmb3IgY29uZmlnIGFuZCBob29rcy5cbiAgdXBzZXJ0T25lT2JqZWN0KFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogU2NoZW1hVHlwZSxcbiAgICBxdWVyeTogUXVlcnlUeXBlLFxuICAgIHVwZGF0ZTogYW55LFxuICAgIHRyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55XG4gICkge1xuICAgIHNjaGVtYSA9IGNvbnZlcnRQYXJzZVNjaGVtYVRvTW9uZ29TY2hlbWEoc2NoZW1hKTtcbiAgICBjb25zdCBtb25nb1VwZGF0ZSA9IHRyYW5zZm9ybVVwZGF0ZShjbGFzc05hbWUsIHVwZGF0ZSwgc2NoZW1hKTtcbiAgICBjb25zdCBtb25nb1doZXJlID0gdHJhbnNmb3JtV2hlcmUoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKTtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi51cHNlcnRPbmUobW9uZ29XaGVyZSwgbW9uZ29VcGRhdGUsIHRyYW5zYWN0aW9uYWxTZXNzaW9uKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEV4ZWN1dGVzIGEgZmluZC4gQWNjZXB0czogY2xhc3NOYW1lLCBxdWVyeSBpbiBQYXJzZSBmb3JtYXQsIGFuZCB7IHNraXAsIGxpbWl0LCBzb3J0IH0uXG4gIGZpbmQoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIHF1ZXJ5OiBRdWVyeVR5cGUsXG4gICAgeyBza2lwLCBsaW1pdCwgc29ydCwga2V5cywgcmVhZFByZWZlcmVuY2UsIGhpbnQsIGNhc2VJbnNlbnNpdGl2ZSwgZXhwbGFpbiB9OiBRdWVyeU9wdGlvbnNcbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICB2YWxpZGF0ZUV4cGxhaW5WYWx1ZShleHBsYWluKTtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29XaGVyZSA9IHRyYW5zZm9ybVdoZXJlKGNsYXNzTmFtZSwgcXVlcnksIHNjaGVtYSk7XG4gICAgY29uc3QgbW9uZ29Tb3J0ID0gXy5tYXBLZXlzKHNvcnQsICh2YWx1ZSwgZmllbGROYW1lKSA9PlxuICAgICAgdHJhbnNmb3JtS2V5KGNsYXNzTmFtZSwgZmllbGROYW1lLCBzY2hlbWEpXG4gICAgKTtcbiAgICBjb25zdCBtb25nb0tleXMgPSBfLnJlZHVjZShcbiAgICAgIGtleXMsXG4gICAgICAobWVtbywga2V5KSA9PiB7XG4gICAgICAgIGlmIChrZXkgPT09ICdBQ0wnKSB7XG4gICAgICAgICAgbWVtb1snX3JwZXJtJ10gPSAxO1xuICAgICAgICAgIG1lbW9bJ193cGVybSddID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtZW1vW3RyYW5zZm9ybUtleShjbGFzc05hbWUsIGtleSwgc2NoZW1hKV0gPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtZW1vO1xuICAgICAgfSxcbiAgICAgIHt9XG4gICAgKTtcblxuICAgIC8vIElmIHdlIGFyZW4ndCByZXF1ZXN0aW5nIHRoZSBgX2lkYCBmaWVsZCwgd2UgbmVlZCB0byBleHBsaWNpdGx5IG9wdCBvdXRcbiAgICAvLyBvZiBpdC4gRG9pbmcgc28gaW4gcGFyc2Utc2VydmVyIGlzIHVudXN1YWwsIGJ1dCBpdCBjYW4gYWxsb3cgdXMgdG9cbiAgICAvLyBvcHRpbWl6ZSBzb21lIHF1ZXJpZXMgd2l0aCBjb3ZlcmluZyBpbmRleGVzLlxuICAgIGlmIChrZXlzICYmICFtb25nb0tleXMuX2lkKSB7XG4gICAgICBtb25nb0tleXMuX2lkID0gMDtcbiAgICB9XG5cbiAgICByZWFkUHJlZmVyZW5jZSA9IHRoaXMuX3BhcnNlUmVhZFByZWZlcmVuY2UocmVhZFByZWZlcmVuY2UpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZVRleHRJbmRleGVzSWZOZWVkZWQoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKVxuICAgICAgLnRoZW4oKCkgPT4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSkpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+XG4gICAgICAgIGNvbGxlY3Rpb24uZmluZChtb25nb1doZXJlLCB7XG4gICAgICAgICAgc2tpcCxcbiAgICAgICAgICBsaW1pdCxcbiAgICAgICAgICBzb3J0OiBtb25nb1NvcnQsXG4gICAgICAgICAga2V5czogbW9uZ29LZXlzLFxuICAgICAgICAgIG1heFRpbWVNUzogdGhpcy5fbWF4VGltZU1TLFxuICAgICAgICAgIHJlYWRQcmVmZXJlbmNlLFxuICAgICAgICAgIGhpbnQsXG4gICAgICAgICAgY2FzZUluc2Vuc2l0aXZlLFxuICAgICAgICAgIGV4cGxhaW4sXG4gICAgICAgIH0pXG4gICAgICApXG4gICAgICAudGhlbihvYmplY3RzID0+IHtcbiAgICAgICAgaWYgKGV4cGxhaW4pIHtcbiAgICAgICAgICByZXR1cm4gb2JqZWN0cztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb2JqZWN0cy5tYXAob2JqZWN0ID0+IG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdChjbGFzc05hbWUsIG9iamVjdCwgc2NoZW1hKSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgZW5zdXJlSW5kZXgoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgc2NoZW1hOiBTY2hlbWFUeXBlLFxuICAgIGZpZWxkTmFtZXM6IHN0cmluZ1tdLFxuICAgIGluZGV4TmFtZTogP3N0cmluZyxcbiAgICBjYXNlSW5zZW5zaXRpdmU6IGJvb2xlYW4gPSBmYWxzZSxcbiAgICBvcHRpb25zPzogT2JqZWN0ID0ge31cbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgaW5kZXhDcmVhdGlvblJlcXVlc3QgPSB7fTtcbiAgICBjb25zdCBtb25nb0ZpZWxkTmFtZXMgPSBmaWVsZE5hbWVzLm1hcChmaWVsZE5hbWUgPT4gdHJhbnNmb3JtS2V5KGNsYXNzTmFtZSwgZmllbGROYW1lLCBzY2hlbWEpKTtcbiAgICBtb25nb0ZpZWxkTmFtZXMuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgaW5kZXhDcmVhdGlvblJlcXVlc3RbZmllbGROYW1lXSA9IG9wdGlvbnMuaW5kZXhUeXBlICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmluZGV4VHlwZSA6IDE7XG4gICAgfSk7XG5cbiAgICBjb25zdCBkZWZhdWx0T3B0aW9uczogT2JqZWN0ID0geyBiYWNrZ3JvdW5kOiB0cnVlLCBzcGFyc2U6IHRydWUgfTtcbiAgICBjb25zdCBpbmRleE5hbWVPcHRpb25zOiBPYmplY3QgPSBpbmRleE5hbWUgPyB7IG5hbWU6IGluZGV4TmFtZSB9IDoge307XG4gICAgY29uc3QgdHRsT3B0aW9uczogT2JqZWN0ID0gb3B0aW9ucy50dGwgIT09IHVuZGVmaW5lZCA/IHsgZXhwaXJlQWZ0ZXJTZWNvbmRzOiBvcHRpb25zLnR0bCB9IDoge307XG4gICAgY29uc3QgY2FzZUluc2Vuc2l0aXZlT3B0aW9uczogT2JqZWN0ID0gY2FzZUluc2Vuc2l0aXZlXG4gICAgICA/IHsgY29sbGF0aW9uOiBNb25nb0NvbGxlY3Rpb24uY2FzZUluc2Vuc2l0aXZlQ29sbGF0aW9uKCkgfVxuICAgICAgOiB7fTtcbiAgICBjb25zdCBpbmRleE9wdGlvbnM6IE9iamVjdCA9IHtcbiAgICAgIC4uLmRlZmF1bHRPcHRpb25zLFxuICAgICAgLi4uY2FzZUluc2Vuc2l0aXZlT3B0aW9ucyxcbiAgICAgIC4uLmluZGV4TmFtZU9wdGlvbnMsXG4gICAgICAuLi50dGxPcHRpb25zLFxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKFxuICAgICAgICBjb2xsZWN0aW9uID0+XG4gICAgICAgICAgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT5cbiAgICAgICAgICAgIGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5jcmVhdGVJbmRleChpbmRleENyZWF0aW9uUmVxdWVzdCwgaW5kZXhPcHRpb25zLCBlcnJvciA9PlxuICAgICAgICAgICAgICBlcnJvciA/IHJlamVjdChlcnJvcikgOiByZXNvbHZlKClcbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICApXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICAvLyBDcmVhdGUgYSB1bmlxdWUgaW5kZXguIFVuaXF1ZSBpbmRleGVzIG9uIG51bGxhYmxlIGZpZWxkcyBhcmUgbm90IGFsbG93ZWQuIFNpbmNlIHdlIGRvbid0XG4gIC8vIGN1cnJlbnRseSBrbm93IHdoaWNoIGZpZWxkcyBhcmUgbnVsbGFibGUgYW5kIHdoaWNoIGFyZW4ndCwgd2UgaWdub3JlIHRoYXQgY3JpdGVyaWEuXG4gIC8vIEFzIHN1Y2gsIHdlIHNob3VsZG4ndCBleHBvc2UgdGhpcyBmdW5jdGlvbiB0byB1c2VycyBvZiBwYXJzZSB1bnRpbCB3ZSBoYXZlIGFuIG91dC1vZi1iYW5kXG4gIC8vIFdheSBvZiBkZXRlcm1pbmluZyBpZiBhIGZpZWxkIGlzIG51bGxhYmxlLiBVbmRlZmluZWQgZG9lc24ndCBjb3VudCBhZ2FpbnN0IHVuaXF1ZW5lc3MsXG4gIC8vIHdoaWNoIGlzIHdoeSB3ZSB1c2Ugc3BhcnNlIGluZGV4ZXMuXG4gIGVuc3VyZVVuaXF1ZW5lc3MoY2xhc3NOYW1lOiBzdHJpbmcsIHNjaGVtYTogU2NoZW1hVHlwZSwgZmllbGROYW1lczogc3RyaW5nW10pIHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgY29uc3QgaW5kZXhDcmVhdGlvblJlcXVlc3QgPSB7fTtcbiAgICBjb25zdCBtb25nb0ZpZWxkTmFtZXMgPSBmaWVsZE5hbWVzLm1hcChmaWVsZE5hbWUgPT4gdHJhbnNmb3JtS2V5KGNsYXNzTmFtZSwgZmllbGROYW1lLCBzY2hlbWEpKTtcbiAgICBtb25nb0ZpZWxkTmFtZXMuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgaW5kZXhDcmVhdGlvblJlcXVlc3RbZmllbGROYW1lXSA9IDE7XG4gICAgfSk7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uX2Vuc3VyZVNwYXJzZVVuaXF1ZUluZGV4SW5CYWNrZ3JvdW5kKGluZGV4Q3JlYXRpb25SZXF1ZXN0KSlcbiAgICAgIC5jYXRjaChlcnJvciA9PiB7XG4gICAgICAgIGlmIChlcnJvci5jb2RlID09PSAxMTAwMCkge1xuICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgIFBhcnNlLkVycm9yLkRVUExJQ0FURV9WQUxVRSxcbiAgICAgICAgICAgICdUcmllZCB0byBlbnN1cmUgZmllbGQgdW5pcXVlbmVzcyBmb3IgYSBjbGFzcyB0aGF0IGFscmVhZHkgaGFzIGR1cGxpY2F0ZXMuJ1xuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgLy8gVXNlZCBpbiB0ZXN0c1xuICBfcmF3RmluZChjbGFzc05hbWU6IHN0cmluZywgcXVlcnk6IFF1ZXJ5VHlwZSkge1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PlxuICAgICAgICBjb2xsZWN0aW9uLmZpbmQocXVlcnksIHtcbiAgICAgICAgICBtYXhUaW1lTVM6IHRoaXMuX21heFRpbWVNUyxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIC8vIEV4ZWN1dGVzIGEgY291bnQuXG4gIGNvdW50KFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogU2NoZW1hVHlwZSxcbiAgICBxdWVyeTogUXVlcnlUeXBlLFxuICAgIHJlYWRQcmVmZXJlbmNlOiA/c3RyaW5nLFxuICAgIGhpbnQ6ID9taXhlZFxuICApIHtcbiAgICBzY2hlbWEgPSBjb252ZXJ0UGFyc2VTY2hlbWFUb01vbmdvU2NoZW1hKHNjaGVtYSk7XG4gICAgcmVhZFByZWZlcmVuY2UgPSB0aGlzLl9wYXJzZVJlYWRQcmVmZXJlbmNlKHJlYWRQcmVmZXJlbmNlKTtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT5cbiAgICAgICAgY29sbGVjdGlvbi5jb3VudCh0cmFuc2Zvcm1XaGVyZShjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWEsIHRydWUpLCB7XG4gICAgICAgICAgbWF4VGltZU1TOiB0aGlzLl9tYXhUaW1lTVMsXG4gICAgICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgaGludCxcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIGRpc3RpbmN0KGNsYXNzTmFtZTogc3RyaW5nLCBzY2hlbWE6IFNjaGVtYVR5cGUsIHF1ZXJ5OiBRdWVyeVR5cGUsIGZpZWxkTmFtZTogc3RyaW5nKSB7XG4gICAgc2NoZW1hID0gY29udmVydFBhcnNlU2NoZW1hVG9Nb25nb1NjaGVtYShzY2hlbWEpO1xuICAgIGNvbnN0IGlzUG9pbnRlckZpZWxkID0gc2NoZW1hLmZpZWxkc1tmaWVsZE5hbWVdICYmIHNjaGVtYS5maWVsZHNbZmllbGROYW1lXS50eXBlID09PSAnUG9pbnRlcic7XG4gICAgY29uc3QgdHJhbnNmb3JtRmllbGQgPSB0cmFuc2Zvcm1LZXkoY2xhc3NOYW1lLCBmaWVsZE5hbWUsIHNjaGVtYSk7XG5cbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT5cbiAgICAgICAgY29sbGVjdGlvbi5kaXN0aW5jdCh0cmFuc2Zvcm1GaWVsZCwgdHJhbnNmb3JtV2hlcmUoY2xhc3NOYW1lLCBxdWVyeSwgc2NoZW1hKSlcbiAgICAgIClcbiAgICAgIC50aGVuKG9iamVjdHMgPT4ge1xuICAgICAgICBvYmplY3RzID0gb2JqZWN0cy5maWx0ZXIob2JqID0+IG9iaiAhPSBudWxsKTtcbiAgICAgICAgcmV0dXJuIG9iamVjdHMubWFwKG9iamVjdCA9PiB7XG4gICAgICAgICAgaWYgKGlzUG9pbnRlckZpZWxkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJhbnNmb3JtUG9pbnRlclN0cmluZyhzY2hlbWEsIGZpZWxkTmFtZSwgb2JqZWN0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG1vbmdvT2JqZWN0VG9QYXJzZU9iamVjdChjbGFzc05hbWUsIG9iamVjdCwgc2NoZW1hKTtcbiAgICAgICAgfSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgYWdncmVnYXRlKFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHNjaGVtYTogYW55LFxuICAgIHBpcGVsaW5lOiBhbnksXG4gICAgcmVhZFByZWZlcmVuY2U6ID9zdHJpbmcsXG4gICAgaGludDogP21peGVkLFxuICAgIGV4cGxhaW4/OiBib29sZWFuXG4gICkge1xuICAgIHZhbGlkYXRlRXhwbGFpblZhbHVlKGV4cGxhaW4pO1xuICAgIGxldCBpc1BvaW50ZXJGaWVsZCA9IGZhbHNlO1xuICAgIHBpcGVsaW5lID0gcGlwZWxpbmUubWFwKHN0YWdlID0+IHtcbiAgICAgIGlmIChzdGFnZS4kZ3JvdXApIHtcbiAgICAgICAgc3RhZ2UuJGdyb3VwID0gdGhpcy5fcGFyc2VBZ2dyZWdhdGVHcm91cEFyZ3Moc2NoZW1hLCBzdGFnZS4kZ3JvdXApO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc3RhZ2UuJGdyb3VwLl9pZCAmJlxuICAgICAgICAgIHR5cGVvZiBzdGFnZS4kZ3JvdXAuX2lkID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAgIHN0YWdlLiRncm91cC5faWQuaW5kZXhPZignJF9wXycpID49IDBcbiAgICAgICAgKSB7XG4gICAgICAgICAgaXNQb2ludGVyRmllbGQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoc3RhZ2UuJG1hdGNoKSB7XG4gICAgICAgIHN0YWdlLiRtYXRjaCA9IHRoaXMuX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWEsIHN0YWdlLiRtYXRjaCk7XG4gICAgICB9XG4gICAgICBpZiAoc3RhZ2UuJHByb2plY3QpIHtcbiAgICAgICAgc3RhZ2UuJHByb2plY3QgPSB0aGlzLl9wYXJzZUFnZ3JlZ2F0ZVByb2plY3RBcmdzKHNjaGVtYSwgc3RhZ2UuJHByb2plY3QpO1xuICAgICAgfVxuICAgICAgaWYgKHN0YWdlLiRnZW9OZWFyICYmIHN0YWdlLiRnZW9OZWFyLnF1ZXJ5KSB7XG4gICAgICAgIHN0YWdlLiRnZW9OZWFyLnF1ZXJ5ID0gdGhpcy5fcGFyc2VBZ2dyZWdhdGVBcmdzKHNjaGVtYSwgc3RhZ2UuJGdlb05lYXIucXVlcnkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YWdlO1xuICAgIH0pO1xuICAgIHJlYWRQcmVmZXJlbmNlID0gdGhpcy5fcGFyc2VSZWFkUHJlZmVyZW5jZShyZWFkUHJlZmVyZW5jZSk7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+XG4gICAgICAgIGNvbGxlY3Rpb24uYWdncmVnYXRlKHBpcGVsaW5lLCB7XG4gICAgICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgbWF4VGltZU1TOiB0aGlzLl9tYXhUaW1lTVMsXG4gICAgICAgICAgaGludCxcbiAgICAgICAgICBleHBsYWluLFxuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLnRoZW4ocmVzdWx0cyA9PiB7XG4gICAgICAgIHJlc3VsdHMuZm9yRWFjaChyZXN1bHQgPT4ge1xuICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocmVzdWx0LCAnX2lkJykpIHtcbiAgICAgICAgICAgIGlmIChpc1BvaW50ZXJGaWVsZCAmJiByZXN1bHQuX2lkKSB7XG4gICAgICAgICAgICAgIHJlc3VsdC5faWQgPSByZXN1bHQuX2lkLnNwbGl0KCckJylbMV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIHJlc3VsdC5faWQgPT0gbnVsbCB8fFxuICAgICAgICAgICAgICByZXN1bHQuX2lkID09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICAoWydvYmplY3QnLCAnc3RyaW5nJ10uaW5jbHVkZXModHlwZW9mIHJlc3VsdC5faWQpICYmIF8uaXNFbXB0eShyZXN1bHQuX2lkKSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICByZXN1bHQuX2lkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5vYmplY3RJZCA9IHJlc3VsdC5faWQ7XG4gICAgICAgICAgICBkZWxldGUgcmVzdWx0Ll9pZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH0pXG4gICAgICAudGhlbihvYmplY3RzID0+IG9iamVjdHMubWFwKG9iamVjdCA9PiBtb25nb09iamVjdFRvUGFyc2VPYmplY3QoY2xhc3NOYW1lLCBvYmplY3QsIHNjaGVtYSkpKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY3Vyc2l2ZWx5IHRyYXZlcnNlIHRoZSBwaXBlbGluZSBhbmQgY29udmVydCBhbnkgUG9pbnRlciBvciBEYXRlIGNvbHVtbnMuXG4gIC8vIElmIHdlIGRldGVjdCBhIHBvaW50ZXIgY29sdW1uIHdlIHdpbGwgcmVuYW1lIHRoZSBjb2x1bW4gYmVpbmcgcXVlcmllZCBmb3IgdG8gbWF0Y2ggdGhlIGNvbHVtblxuICAvLyBpbiB0aGUgZGF0YWJhc2UuIFdlIGFsc28gbW9kaWZ5IHRoZSB2YWx1ZSB0byB3aGF0IHdlIGV4cGVjdCB0aGUgdmFsdWUgdG8gYmUgaW4gdGhlIGRhdGFiYXNlXG4gIC8vIGFzIHdlbGwuXG4gIC8vIEZvciBkYXRlcywgdGhlIGRyaXZlciBleHBlY3RzIGEgRGF0ZSBvYmplY3QsIGJ1dCB3ZSBoYXZlIGEgc3RyaW5nIGNvbWluZyBpbi4gU28gd2UnbGwgY29udmVydFxuICAvLyB0aGUgc3RyaW5nIHRvIGEgRGF0ZSBzbyB0aGUgZHJpdmVyIGNhbiBwZXJmb3JtIHRoZSBuZWNlc3NhcnkgY29tcGFyaXNvbi5cbiAgLy9cbiAgLy8gVGhlIGdvYWwgb2YgdGhpcyBtZXRob2QgaXMgdG8gbG9vayBmb3IgdGhlIFwibGVhdmVzXCIgb2YgdGhlIHBpcGVsaW5lIGFuZCBkZXRlcm1pbmUgaWYgaXQgbmVlZHNcbiAgLy8gdG8gYmUgY29udmVydGVkLiBUaGUgcGlwZWxpbmUgY2FuIGhhdmUgYSBmZXcgZGlmZmVyZW50IGZvcm1zLiBGb3IgbW9yZSBkZXRhaWxzLCBzZWU6XG4gIC8vICAgICBodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvci9hZ2dyZWdhdGlvbi9cbiAgLy9cbiAgLy8gSWYgdGhlIHBpcGVsaW5lIGlzIGFuIGFycmF5LCBpdCBtZWFucyB3ZSBhcmUgcHJvYmFibHkgcGFyc2luZyBhbiAnJGFuZCcgb3IgJyRvcicgb3BlcmF0b3IuIEluXG4gIC8vIHRoYXQgY2FzZSB3ZSBuZWVkIHRvIGxvb3AgdGhyb3VnaCBhbGwgb2YgaXQncyBjaGlsZHJlbiB0byBmaW5kIHRoZSBjb2x1bW5zIGJlaW5nIG9wZXJhdGVkIG9uLlxuICAvLyBJZiB0aGUgcGlwZWxpbmUgaXMgYW4gb2JqZWN0LCB0aGVuIHdlJ2xsIGxvb3AgdGhyb3VnaCB0aGUga2V5cyBjaGVja2luZyB0byBzZWUgaWYgdGhlIGtleSBuYW1lXG4gIC8vIG1hdGNoZXMgb25lIG9mIHRoZSBzY2hlbWEgY29sdW1ucy4gSWYgaXQgZG9lcyBtYXRjaCBhIGNvbHVtbiBhbmQgdGhlIGNvbHVtbiBpcyBhIFBvaW50ZXIgb3JcbiAgLy8gYSBEYXRlLCB0aGVuIHdlJ2xsIGNvbnZlcnQgdGhlIHZhbHVlIGFzIGRlc2NyaWJlZCBhYm92ZS5cbiAgLy9cbiAgLy8gQXMgbXVjaCBhcyBJIGhhdGUgcmVjdXJzaW9uLi4udGhpcyBzZWVtZWQgbGlrZSBhIGdvb2QgZml0IGZvciBpdC4gV2UncmUgZXNzZW50aWFsbHkgdHJhdmVyc2luZ1xuICAvLyBkb3duIGEgdHJlZSB0byBmaW5kIGEgXCJsZWFmIG5vZGVcIiBhbmQgY2hlY2tpbmcgdG8gc2VlIGlmIGl0IG5lZWRzIHRvIGJlIGNvbnZlcnRlZC5cbiAgX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWE6IGFueSwgcGlwZWxpbmU6IGFueSk6IGFueSB7XG4gICAgaWYgKHBpcGVsaW5lID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocGlwZWxpbmUpKSB7XG4gICAgICByZXR1cm4gcGlwZWxpbmUubWFwKHZhbHVlID0+IHRoaXMuX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWEsIHZhbHVlKSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcGlwZWxpbmUgPT09ICdvYmplY3QnKSB7XG4gICAgICBjb25zdCByZXR1cm5WYWx1ZSA9IHt9O1xuICAgICAgZm9yIChjb25zdCBmaWVsZCBpbiBwaXBlbGluZSkge1xuICAgICAgICBpZiAoc2NoZW1hLmZpZWxkc1tmaWVsZF0gJiYgc2NoZW1hLmZpZWxkc1tmaWVsZF0udHlwZSA9PT0gJ1BvaW50ZXInKSB7XG4gICAgICAgICAgaWYgKHR5cGVvZiBwaXBlbGluZVtmaWVsZF0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAvLyBQYXNzIG9iamVjdHMgZG93biB0byBNb25nb0RCLi4udGhpcyBpcyBtb3JlIHRoYW4gbGlrZWx5IGFuICRleGlzdHMgb3BlcmF0b3IuXG4gICAgICAgICAgICByZXR1cm5WYWx1ZVtgX3BfJHtmaWVsZH1gXSA9IHBpcGVsaW5lW2ZpZWxkXTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuVmFsdWVbYF9wXyR7ZmllbGR9YF0gPSBgJHtzY2hlbWEuZmllbGRzW2ZpZWxkXS50YXJnZXRDbGFzc30kJHtwaXBlbGluZVtmaWVsZF19YDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoc2NoZW1hLmZpZWxkc1tmaWVsZF0gJiYgc2NoZW1hLmZpZWxkc1tmaWVsZF0udHlwZSA9PT0gJ0RhdGUnKSB7XG4gICAgICAgICAgcmV0dXJuVmFsdWVbZmllbGRdID0gdGhpcy5fY29udmVydFRvRGF0ZShwaXBlbGluZVtmaWVsZF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVyblZhbHVlW2ZpZWxkXSA9IHRoaXMuX3BhcnNlQWdncmVnYXRlQXJncyhzY2hlbWEsIHBpcGVsaW5lW2ZpZWxkXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZmllbGQgPT09ICdvYmplY3RJZCcpIHtcbiAgICAgICAgICByZXR1cm5WYWx1ZVsnX2lkJ10gPSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICAgICAgZGVsZXRlIHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgICAgfSBlbHNlIGlmIChmaWVsZCA9PT0gJ2NyZWF0ZWRBdCcpIHtcbiAgICAgICAgICByZXR1cm5WYWx1ZVsnX2NyZWF0ZWRfYXQnXSA9IHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgICAgICBkZWxldGUgcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgICB9IGVsc2UgaWYgKGZpZWxkID09PSAndXBkYXRlZEF0Jykge1xuICAgICAgICAgIHJldHVyblZhbHVlWydfdXBkYXRlZF9hdCddID0gcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgICAgIGRlbGV0ZSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHBpcGVsaW5lO1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyBzbGlnaHRseSBkaWZmZXJlbnQgdGhhbiB0aGUgb25lIGFib3ZlLiBSYXRoZXIgdGhhbiB0cnlpbmcgdG8gY29tYmluZSB0aGVzZVxuICAvLyB0d28gZnVuY3Rpb25zIGFuZCBtYWtpbmcgdGhlIGNvZGUgZXZlbiBoYXJkZXIgdG8gdW5kZXJzdGFuZCwgSSBkZWNpZGVkIHRvIHNwbGl0IGl0IHVwLiBUaGVcbiAgLy8gZGlmZmVyZW5jZSB3aXRoIHRoaXMgZnVuY3Rpb24gaXMgd2UgYXJlIG5vdCB0cmFuc2Zvcm1pbmcgdGhlIHZhbHVlcywgb25seSB0aGUga2V5cyBvZiB0aGVcbiAgLy8gcGlwZWxpbmUuXG4gIF9wYXJzZUFnZ3JlZ2F0ZVByb2plY3RBcmdzKHNjaGVtYTogYW55LCBwaXBlbGluZTogYW55KTogYW55IHtcbiAgICBjb25zdCByZXR1cm5WYWx1ZSA9IHt9O1xuICAgIGZvciAoY29uc3QgZmllbGQgaW4gcGlwZWxpbmUpIHtcbiAgICAgIGlmIChzY2hlbWEuZmllbGRzW2ZpZWxkXSAmJiBzY2hlbWEuZmllbGRzW2ZpZWxkXS50eXBlID09PSAnUG9pbnRlcicpIHtcbiAgICAgICAgcmV0dXJuVmFsdWVbYF9wXyR7ZmllbGR9YF0gPSBwaXBlbGluZVtmaWVsZF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm5WYWx1ZVtmaWVsZF0gPSB0aGlzLl9wYXJzZUFnZ3JlZ2F0ZUFyZ3Moc2NoZW1hLCBwaXBlbGluZVtmaWVsZF0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmllbGQgPT09ICdvYmplY3RJZCcpIHtcbiAgICAgICAgcmV0dXJuVmFsdWVbJ19pZCddID0gcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgICBkZWxldGUgcmV0dXJuVmFsdWVbZmllbGRdO1xuICAgICAgfSBlbHNlIGlmIChmaWVsZCA9PT0gJ2NyZWF0ZWRBdCcpIHtcbiAgICAgICAgcmV0dXJuVmFsdWVbJ19jcmVhdGVkX2F0J10gPSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICAgIGRlbGV0ZSByZXR1cm5WYWx1ZVtmaWVsZF07XG4gICAgICB9IGVsc2UgaWYgKGZpZWxkID09PSAndXBkYXRlZEF0Jykge1xuICAgICAgICByZXR1cm5WYWx1ZVsnX3VwZGF0ZWRfYXQnXSA9IHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgICAgZGVsZXRlIHJldHVyblZhbHVlW2ZpZWxkXTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJldHVyblZhbHVlO1xuICB9XG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyBzbGlnaHRseSBkaWZmZXJlbnQgdGhhbiB0aGUgdHdvIGFib3ZlLiBNb25nb0RCICRncm91cCBhZ2dyZWdhdGUgbG9va3MgbGlrZTpcbiAgLy8gICAgIHsgJGdyb3VwOiB7IF9pZDogPGV4cHJlc3Npb24+LCA8ZmllbGQxPjogeyA8YWNjdW11bGF0b3IxPiA6IDxleHByZXNzaW9uMT4gfSwgLi4uIH0gfVxuICAvLyBUaGUgPGV4cHJlc3Npb24+IGNvdWxkIGJlIGEgY29sdW1uIG5hbWUsIHByZWZpeGVkIHdpdGggdGhlICckJyBjaGFyYWN0ZXIuIFdlJ2xsIGxvb2sgZm9yXG4gIC8vIHRoZXNlIDxleHByZXNzaW9uPiBhbmQgY2hlY2sgdG8gc2VlIGlmIGl0IGlzIGEgJ1BvaW50ZXInIG9yIGlmIGl0J3Mgb25lIG9mIGNyZWF0ZWRBdCxcbiAgLy8gdXBkYXRlZEF0IG9yIG9iamVjdElkIGFuZCBjaGFuZ2UgaXQgYWNjb3JkaW5nbHkuXG4gIF9wYXJzZUFnZ3JlZ2F0ZUdyb3VwQXJncyhzY2hlbWE6IGFueSwgcGlwZWxpbmU6IGFueSk6IGFueSB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocGlwZWxpbmUpKSB7XG4gICAgICByZXR1cm4gcGlwZWxpbmUubWFwKHZhbHVlID0+IHRoaXMuX3BhcnNlQWdncmVnYXRlR3JvdXBBcmdzKHNjaGVtYSwgdmFsdWUpKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwaXBlbGluZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGNvbnN0IHJldHVyblZhbHVlID0ge307XG4gICAgICBmb3IgKGNvbnN0IGZpZWxkIGluIHBpcGVsaW5lKSB7XG4gICAgICAgIHJldHVyblZhbHVlW2ZpZWxkXSA9IHRoaXMuX3BhcnNlQWdncmVnYXRlR3JvdXBBcmdzKHNjaGVtYSwgcGlwZWxpbmVbZmllbGRdKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwaXBlbGluZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGZpZWxkID0gcGlwZWxpbmUuc3Vic3RyaW5nKDEpO1xuICAgICAgaWYgKHNjaGVtYS5maWVsZHNbZmllbGRdICYmIHNjaGVtYS5maWVsZHNbZmllbGRdLnR5cGUgPT09ICdQb2ludGVyJykge1xuICAgICAgICByZXR1cm4gYCRfcF8ke2ZpZWxkfWA7XG4gICAgICB9IGVsc2UgaWYgKGZpZWxkID09ICdjcmVhdGVkQXQnKSB7XG4gICAgICAgIHJldHVybiAnJF9jcmVhdGVkX2F0JztcbiAgICAgIH0gZWxzZSBpZiAoZmllbGQgPT0gJ3VwZGF0ZWRBdCcpIHtcbiAgICAgICAgcmV0dXJuICckX3VwZGF0ZWRfYXQnO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcGlwZWxpbmU7XG4gIH1cblxuICAvLyBUaGlzIGZ1bmN0aW9uIHdpbGwgYXR0ZW1wdCB0byBjb252ZXJ0IHRoZSBwcm92aWRlZCB2YWx1ZSB0byBhIERhdGUgb2JqZWN0LiBTaW5jZSB0aGlzIGlzIHBhcnRcbiAgLy8gb2YgYW4gYWdncmVnYXRpb24gcGlwZWxpbmUsIHRoZSB2YWx1ZSBjYW4gZWl0aGVyIGJlIGEgc3RyaW5nIG9yIGl0IGNhbiBiZSBhbm90aGVyIG9iamVjdCB3aXRoXG4gIC8vIGFuIG9wZXJhdG9yIGluIGl0IChsaWtlICRndCwgJGx0LCBldGMpLiBCZWNhdXNlIG9mIHRoaXMgSSBmZWx0IGl0IHdhcyBlYXNpZXIgdG8gbWFrZSB0aGlzIGFcbiAgLy8gcmVjdXJzaXZlIG1ldGhvZCB0byB0cmF2ZXJzZSBkb3duIHRvIHRoZSBcImxlYWYgbm9kZVwiIHdoaWNoIGlzIGdvaW5nIHRvIGJlIHRoZSBzdHJpbmcuXG4gIF9jb252ZXJ0VG9EYXRlKHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBuZXcgRGF0ZSh2YWx1ZSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmV0dXJuVmFsdWUgPSB7fTtcbiAgICBmb3IgKGNvbnN0IGZpZWxkIGluIHZhbHVlKSB7XG4gICAgICByZXR1cm5WYWx1ZVtmaWVsZF0gPSB0aGlzLl9jb252ZXJ0VG9EYXRlKHZhbHVlW2ZpZWxkXSk7XG4gICAgfVxuICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgfVxuXG4gIF9wYXJzZVJlYWRQcmVmZXJlbmNlKHJlYWRQcmVmZXJlbmNlOiA/c3RyaW5nKTogP3N0cmluZyB7XG4gICAgaWYgKHJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICByZWFkUHJlZmVyZW5jZSA9IHJlYWRQcmVmZXJlbmNlLnRvVXBwZXJDYXNlKCk7XG4gICAgfVxuICAgIHN3aXRjaCAocmVhZFByZWZlcmVuY2UpIHtcbiAgICAgIGNhc2UgJ1BSSU1BUlknOlxuICAgICAgICByZWFkUHJlZmVyZW5jZSA9IFJlYWRQcmVmZXJlbmNlLlBSSU1BUlk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnUFJJTUFSWV9QUkVGRVJSRUQnOlxuICAgICAgICByZWFkUHJlZmVyZW5jZSA9IFJlYWRQcmVmZXJlbmNlLlBSSU1BUllfUFJFRkVSUkVEO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ1NFQ09OREFSWSc6XG4gICAgICAgIHJlYWRQcmVmZXJlbmNlID0gUmVhZFByZWZlcmVuY2UuU0VDT05EQVJZO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ1NFQ09OREFSWV9QUkVGRVJSRUQnOlxuICAgICAgICByZWFkUHJlZmVyZW5jZSA9IFJlYWRQcmVmZXJlbmNlLlNFQ09OREFSWV9QUkVGRVJSRUQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnTkVBUkVTVCc6XG4gICAgICAgIHJlYWRQcmVmZXJlbmNlID0gUmVhZFByZWZlcmVuY2UuTkVBUkVTVDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgIGNhc2UgbnVsbDpcbiAgICAgIGNhc2UgJyc6XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksICdOb3Qgc3VwcG9ydGVkIHJlYWQgcHJlZmVyZW5jZS4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlYWRQcmVmZXJlbmNlO1xuICB9XG5cbiAgcGVyZm9ybUluaXRpYWxpemF0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIGNyZWF0ZUluZGV4KGNsYXNzTmFtZTogc3RyaW5nLCBpbmRleDogYW55KSB7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5jcmVhdGVJbmRleChpbmRleCkpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBjcmVhdGVJbmRleGVzKGNsYXNzTmFtZTogc3RyaW5nLCBpbmRleGVzOiBhbnkpIHtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi5fbW9uZ29Db2xsZWN0aW9uLmNyZWF0ZUluZGV4ZXMoaW5kZXhlcykpXG4gICAgICAuY2F0Y2goZXJyID0+IHRoaXMuaGFuZGxlRXJyb3IoZXJyKSk7XG4gIH1cblxuICBjcmVhdGVJbmRleGVzSWZOZWVkZWQoY2xhc3NOYW1lOiBzdHJpbmcsIGZpZWxkTmFtZTogc3RyaW5nLCB0eXBlOiBhbnkpIHtcbiAgICBpZiAodHlwZSAmJiB0eXBlLnR5cGUgPT09ICdQb2x5Z29uJykge1xuICAgICAgY29uc3QgaW5kZXggPSB7XG4gICAgICAgIFtmaWVsZE5hbWVdOiAnMmRzcGhlcmUnLFxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUluZGV4KGNsYXNzTmFtZSwgaW5kZXgpO1xuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBjcmVhdGVUZXh0SW5kZXhlc0lmTmVlZGVkKGNsYXNzTmFtZTogc3RyaW5nLCBxdWVyeTogUXVlcnlUeXBlLCBzY2hlbWE6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGZvciAoY29uc3QgZmllbGROYW1lIGluIHF1ZXJ5KSB7XG4gICAgICBpZiAoIXF1ZXJ5W2ZpZWxkTmFtZV0gfHwgIXF1ZXJ5W2ZpZWxkTmFtZV0uJHRleHQpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjb25zdCBleGlzdGluZ0luZGV4ZXMgPSBzY2hlbWEuaW5kZXhlcztcbiAgICAgIGZvciAoY29uc3Qga2V5IGluIGV4aXN0aW5nSW5kZXhlcykge1xuICAgICAgICBjb25zdCBpbmRleCA9IGV4aXN0aW5nSW5kZXhlc1trZXldO1xuICAgICAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGluZGV4LCBmaWVsZE5hbWUpKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBpbmRleE5hbWUgPSBgJHtmaWVsZE5hbWV9X3RleHRgO1xuICAgICAgY29uc3QgdGV4dEluZGV4ID0ge1xuICAgICAgICBbaW5kZXhOYW1lXTogeyBbZmllbGROYW1lXTogJ3RleHQnIH0sXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXMuc2V0SW5kZXhlc1dpdGhTY2hlbWFGb3JtYXQoXG4gICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgdGV4dEluZGV4LFxuICAgICAgICBleGlzdGluZ0luZGV4ZXMsXG4gICAgICAgIHNjaGVtYS5maWVsZHNcbiAgICAgICkuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBpZiAoZXJyb3IuY29kZSA9PT0gODUpIHtcbiAgICAgICAgICAvLyBJbmRleCBleGlzdCB3aXRoIGRpZmZlcmVudCBvcHRpb25zXG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2V0SW5kZXhlc0Zyb21Nb25nbyhjbGFzc05hbWUpO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIGdldEluZGV4ZXMoY2xhc3NOYW1lOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5fYWRhcHRpdmVDb2xsZWN0aW9uKGNsYXNzTmFtZSlcbiAgICAgIC50aGVuKGNvbGxlY3Rpb24gPT4gY29sbGVjdGlvbi5fbW9uZ29Db2xsZWN0aW9uLmluZGV4ZXMoKSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIGRyb3BJbmRleChjbGFzc05hbWU6IHN0cmluZywgaW5kZXg6IGFueSkge1xuICAgIHJldHVybiB0aGlzLl9hZGFwdGl2ZUNvbGxlY3Rpb24oY2xhc3NOYW1lKVxuICAgICAgLnRoZW4oY29sbGVjdGlvbiA9PiBjb2xsZWN0aW9uLl9tb25nb0NvbGxlY3Rpb24uZHJvcEluZGV4KGluZGV4KSlcbiAgICAgIC5jYXRjaChlcnIgPT4gdGhpcy5oYW5kbGVFcnJvcihlcnIpKTtcbiAgfVxuXG4gIGRyb3BBbGxJbmRleGVzKGNsYXNzTmFtZTogc3RyaW5nKSB7XG4gICAgcmV0dXJuIHRoaXMuX2FkYXB0aXZlQ29sbGVjdGlvbihjbGFzc05hbWUpXG4gICAgICAudGhlbihjb2xsZWN0aW9uID0+IGNvbGxlY3Rpb24uX21vbmdvQ29sbGVjdGlvbi5kcm9wSW5kZXhlcygpKVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgdXBkYXRlU2NoZW1hV2l0aEluZGV4ZXMoKTogUHJvbWlzZTxhbnk+IHtcbiAgICByZXR1cm4gdGhpcy5nZXRBbGxDbGFzc2VzKClcbiAgICAgIC50aGVuKGNsYXNzZXMgPT4ge1xuICAgICAgICBjb25zdCBwcm9taXNlcyA9IGNsYXNzZXMubWFwKHNjaGVtYSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMuc2V0SW5kZXhlc0Zyb21Nb25nbyhzY2hlbWEuY2xhc3NOYW1lKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB0aGlzLmhhbmRsZUVycm9yKGVycikpO1xuICB9XG5cbiAgY3JlYXRlVHJhbnNhY3Rpb25hbFNlc3Npb24oKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB0cmFuc2FjdGlvbmFsU2VjdGlvbiA9IHRoaXMuY2xpZW50LnN0YXJ0U2Vzc2lvbigpO1xuICAgIHRyYW5zYWN0aW9uYWxTZWN0aW9uLnN0YXJ0VHJhbnNhY3Rpb24oKTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRyYW5zYWN0aW9uYWxTZWN0aW9uKTtcbiAgfVxuXG4gIGNvbW1pdFRyYW5zYWN0aW9uYWxTZXNzaW9uKHRyYW5zYWN0aW9uYWxTZWN0aW9uOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjb21taXQgPSByZXRyaWVzID0+IHtcbiAgICAgIHJldHVybiB0cmFuc2FjdGlvbmFsU2VjdGlvblxuICAgICAgICAuY29tbWl0VHJhbnNhY3Rpb24oKVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGlmIChlcnJvciAmJiBlcnJvci5oYXNFcnJvckxhYmVsKCdUcmFuc2llbnRUcmFuc2FjdGlvbkVycm9yJykgJiYgcmV0cmllcyA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBjb21taXQocmV0cmllcyAtIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHRyYW5zYWN0aW9uYWxTZWN0aW9uLmVuZFNlc3Npb24oKTtcbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICByZXR1cm4gY29tbWl0KDUpO1xuICB9XG5cbiAgYWJvcnRUcmFuc2FjdGlvbmFsU2Vzc2lvbih0cmFuc2FjdGlvbmFsU2VjdGlvbjogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRyYW5zYWN0aW9uYWxTZWN0aW9uLmFib3J0VHJhbnNhY3Rpb24oKS50aGVuKCgpID0+IHtcbiAgICAgIHRyYW5zYWN0aW9uYWxTZWN0aW9uLmVuZFNlc3Npb24oKTtcbiAgICB9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNb25nb1N0b3JhZ2VBZGFwdGVyO1xuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFDQTtBQUNBO0FBQ0E7QUFFQTtBQUNBO0FBU0E7QUFFQTtBQUNBO0FBQ0E7QUFBcUM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBRXJDO0FBQ0EsTUFBTUEsT0FBTyxHQUFHQyxPQUFPLENBQUMsU0FBUyxDQUFDO0FBQ2xDLE1BQU1DLFdBQVcsR0FBR0YsT0FBTyxDQUFDRSxXQUFXO0FBQ3ZDLE1BQU1DLGNBQWMsR0FBR0gsT0FBTyxDQUFDRyxjQUFjO0FBRTdDLE1BQU1DLHlCQUF5QixHQUFHLFNBQVM7QUFFM0MsTUFBTUMsNEJBQTRCLEdBQUdDLFlBQVksSUFBSTtFQUNuRCxPQUFPQSxZQUFZLENBQ2hCQyxPQUFPLEVBQUUsQ0FDVEMsSUFBSSxDQUFDLE1BQU1GLFlBQVksQ0FBQ0csUUFBUSxDQUFDQyxXQUFXLEVBQUUsQ0FBQyxDQUMvQ0YsSUFBSSxDQUFDRSxXQUFXLElBQUk7SUFDbkIsT0FBT0EsV0FBVyxDQUFDQyxNQUFNLENBQUNDLFVBQVUsSUFBSTtNQUN0QyxJQUFJQSxVQUFVLENBQUNDLFNBQVMsQ0FBQ0MsS0FBSyxDQUFDLFlBQVksQ0FBQyxFQUFFO1FBQzVDLE9BQU8sS0FBSztNQUNkO01BQ0E7TUFDQTtNQUNBLE9BQU9GLFVBQVUsQ0FBQ0csY0FBYyxDQUFDQyxPQUFPLENBQUNWLFlBQVksQ0FB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