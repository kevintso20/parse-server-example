"use strict";

var _node = require("parse/node");
var _lodash = _interopRequireDefault(require("lodash"));
var _intersect = _interopRequireDefault(require("intersect"));
var _deepcopy = _interopRequireDefault(require("deepcopy"));
var _logger = _interopRequireDefault(require("../logger"));
var _Utils = _interopRequireDefault(require("../Utils"));
var SchemaController = _interopRequireWildcard(require("./SchemaController"));
var _StorageAdapter = require("../Adapters/Storage/StorageAdapter");
var _MongoStorageAdapter = _interopRequireDefault(require("../Adapters/Storage/Mongo/MongoStorageAdapter"));
var _PostgresStorageAdapter = _interopRequireDefault(require("../Adapters/Storage/Postgres/PostgresStorageAdapter"));
var _SchemaCache = _interopRequireDefault(require("../Adapters/Cache/SchemaCache"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }
function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }
function addWriteACL(query, acl) {
  const newQuery = _lodash.default.cloneDeep(query);
  //Can't be any existing '_wperm' query, we don't allow client queries on that, no need to $and
  newQuery._wperm = {
    $in: [null, ...acl]
  };
  return newQuery;
}
function addReadACL(query, acl) {
  const newQuery = _lodash.default.cloneDeep(query);
  //Can't be any existing '_rperm' query, we don't allow client queries on that, no need to $and
  newQuery._rperm = {
    $in: [null, '*', ...acl]
  };
  return newQuery;
}

// Transforms a REST API formatted ACL object to our two-field mongo format.
const transformObjectACL = _ref => {
  let {
      ACL
    } = _ref,
    result = _objectWithoutProperties(_ref, ["ACL"]);
  if (!ACL) {
    return result;
  }
  result._wperm = [];
  result._rperm = [];
  for (const entry in ACL) {
    if (ACL[entry].read) {
      result._rperm.push(entry);
    }
    if (ACL[entry].write) {
      result._wperm.push(entry);
    }
  }
  return result;
};
const specialQueryKeys = ['$and', '$or', '$nor', '_rperm', '_wperm'];
const specialMasterQueryKeys = [...specialQueryKeys, '_email_verify_token', '_perishable_token', '_tombstone', '_email_verify_token_expires_at', '_failed_login_count', '_account_lockout_expires_at', '_password_changed_at', '_password_history'];
const validateQuery = (query, isMaster, isMaintenance, update) => {
  if (isMaintenance) {
    isMaster = true;
  }
  if (query.ACL) {
    throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Cannot query on ACL.');
  }
  if (query.$or) {
    if (query.$or instanceof Array) {
      query.$or.forEach(value => validateQuery(value, isMaster, isMaintenance, update));
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $or format - use an array value.');
    }
  }
  if (query.$and) {
    if (query.$and instanceof Array) {
      query.$and.forEach(value => validateQuery(value, isMaster, isMaintenance, update));
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $and format - use an array value.');
    }
  }
  if (query.$nor) {
    if (query.$nor instanceof Array && query.$nor.length > 0) {
      query.$nor.forEach(value => validateQuery(value, isMaster, isMaintenance, update));
    } else {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, 'Bad $nor format - use an array of at least 1 value.');
    }
  }
  Object.keys(query).forEach(key => {
    if (query && query[key] && query[key].$regex) {
      if (typeof query[key].$options === 'string') {
        if (!query[key].$options.match(/^[imxs]+$/)) {
          throw new _node.Parse.Error(_node.Parse.Error.INVALID_QUERY, `Bad $options value for query: ${query[key].$options}`);
        }
      }
    }
    if (!key.match(/^[a-zA-Z][a-zA-Z0-9_\.]*$/) && (!specialQueryKeys.includes(key) && !isMaster && !update || update && isMaster && !specialMasterQueryKeys.includes(key))) {
      throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid key name: ${key}`);
    }
  });
};

// Filters out any data that shouldn't be on this REST-formatted object.
const filterSensitiveData = (isMaster, isMaintenance, aclGroup, auth, operation, schema, className, protectedFields, object) => {
  let userId = null;
  if (auth && auth.user) userId = auth.user.id;

  // replace protectedFields when using pointer-permissions
  const perms = schema && schema.getClassLevelPermissions ? schema.getClassLevelPermissions(className) : {};
  if (perms) {
    const isReadOperation = ['get', 'find'].indexOf(operation) > -1;
    if (isReadOperation && perms.protectedFields) {
      // extract protectedFields added with the pointer-permission prefix
      const protectedFieldsPointerPerm = Object.keys(perms.protectedFields).filter(key => key.startsWith('userField:')).map(key => {
        return {
          key: key.substring(10),
          value: perms.protectedFields[key]
        };
      });
      const newProtectedFields = [];
      let overrideProtectedFields = false;

      // check if the object grants the current user access based on the extracted fields
      protectedFieldsPointerPerm.forEach(pointerPerm => {
        let pointerPermIncludesUser = false;
        const readUserFieldValue = object[pointerPerm.key];
        if (readUserFieldValue) {
          if (Array.isArray(readUserFieldValue)) {
            pointerPermIncludesUser = readUserFieldValue.some(user => user.objectId && user.objectId === userId);
          } else {
            pointerPermIncludesUser = readUserFieldValue.objectId && readUserFieldValue.objectId === userId;
          }
        }
        if (pointerPermIncludesUser) {
          overrideProtectedFields = true;
          newProtectedFields.push(pointerPerm.value);
        }
      });

      // if at least one pointer-permission affected the current user
      // intersect vs protectedFields from previous stage (@see addProtectedFields)
      // Sets theory (intersections): A x (B x C) == (A x B) x C
      if (overrideProtectedFields && protectedFields) {
        newProtectedFields.push(protectedFields);
      }
      // intersect all sets of protectedFields
      newProtectedFields.forEach(fields => {
        if (fields) {
          // if there're no protctedFields by other criteria ( id / role / auth)
          // then we must intersect each set (per userField)
          if (!protectedFields) {
            protectedFields = fields;
          } else {
            protectedFields = protectedFields.filter(v => fields.includes(v));
          }
        }
      });
    }
  }
  const isUserClass = className === '_User';
  if (isUserClass) {
    object.password = object._hashed_password;
    delete object._hashed_password;
    delete object.sessionToken;
  }
  if (isMaintenance) {
    return object;
  }

  /* special treat for the user class: don't filter protectedFields if currently loggedin user is
  the retrieved user */
  if (!(isUserClass && userId && object.objectId === userId)) {
    var _perms$protectedField, _perms$protectedField2;
    protectedFields && protectedFields.forEach(k => delete object[k]);

    // fields not requested by client (excluded),
    // but were needed to apply protectedFields
    perms === null || perms === void 0 ? void 0 : (_perms$protectedField = perms.protectedFields) === null || _perms$protectedField === void 0 ? void 0 : (_perms$protectedField2 = _perms$protectedField.temporaryKeys) === null || _perms$protectedField2 === void 0 ? void 0 : _perms$protectedField2.forEach(k => delete object[k]);
  }
  for (const key in object) {
    if (key.charAt(0) === '_') {
      delete object[key];
    }
  }
  if (!isUserClass || isMaster) {
    return object;
  }
  if (aclGroup.indexOf(object.objectId) > -1) {
    return object;
  }
  delete object.authData;
  return object;
};

// Runs an update on the database.
// Returns a promise for an object with the new values for field
// modifications that don't know their results ahead of time, like
// 'increment'.
// Options:
//   acl:  a list of strings. If the object to be updated has an ACL,
//         one of the provided strings must provide the caller with
//         write permissions.
const specialKeysForUpdate = ['_hashed_password', '_perishable_token', '_email_verify_token', '_email_verify_token_expires_at', '_account_lockout_expires_at', '_failed_login_count', '_perishable_token_expires_at', '_password_changed_at', '_password_history'];
const isSpecialUpdateKey = key => {
  return specialKeysForUpdate.indexOf(key) >= 0;
};
function joinTableName(className, key) {
  return `_Join:${key}:${className}`;
}
const flattenUpdateOperatorsForCreate = object => {
  for (const key in object) {
    if (object[key] && object[key].__op) {
      switch (object[key].__op) {
        case 'Increment':
          if (typeof object[key].amount !== 'number') {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].amount;
          break;
        case 'Add':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].objects;
          break;
        case 'AddUnique':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = object[key].objects;
          break;
        case 'Remove':
          if (!(object[key].objects instanceof Array)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_JSON, 'objects to add must be an array');
          }
          object[key] = [];
          break;
        case 'Delete':
          delete object[key];
          break;
        default:
          throw new _node.Parse.Error(_node.Parse.Error.COMMAND_UNAVAILABLE, `The ${object[key].__op} operator is not supported yet.`);
      }
    }
  }
};
const transformAuthData = (className, object, schema) => {
  if (object.authData && className === '_User') {
    Object.keys(object.authData).forEach(provider => {
      const providerData = object.authData[provider];
      const fieldName = `_auth_data_${provider}`;
      if (providerData == null) {
        object[fieldName] = {
          __op: 'Delete'
        };
      } else {
        object[fieldName] = providerData;
        schema.fields[fieldName] = {
          type: 'Object'
        };
      }
    });
    delete object.authData;
  }
};
// Transforms a Database format ACL to a REST API format ACL
const untransformObjectACL = _ref2 => {
  let {
      _rperm,
      _wperm
    } = _ref2,
    output = _objectWithoutProperties(_ref2, ["_rperm", "_wperm"]);
  if (_rperm || _wperm) {
    output.ACL = {};
    (_rperm || []).forEach(entry => {
      if (!output.ACL[entry]) {
        output.ACL[entry] = {
          read: true
        };
      } else {
        output.ACL[entry]['read'] = true;
      }
    });
    (_wperm || []).forEach(entry => {
      if (!output.ACL[entry]) {
        output.ACL[entry] = {
          write: true
        };
      } else {
        output.ACL[entry]['write'] = true;
      }
    });
  }
  return output;
};

/**
 * When querying, the fieldName may be compound, extract the root fieldName
 *     `temperature.celsius` becomes `temperature`
 * @param {string} fieldName that may be a compound field name
 * @returns {string} the root name of the field
 */
const getRootFieldName = fieldName => {
  return fieldName.split('.')[0];
};
const relationSchema = {
  fields: {
    relatedId: {
      type: 'String'
    },
    owningId: {
      type: 'String'
    }
  }
};
class DatabaseController {
  constructor(adapter, options) {
    this.adapter = adapter;
    this.options = options || {};
    this.idempotencyOptions = this.options.idempotencyOptions || {};
    // Prevent mutable this.schema, otherwise one request could use
    // multiple schemas, so instead use loadSchema to get a schema.
    this.schemaPromise = null;
    this._transactionalSession = null;
    this.options = options;
  }
  collectionExists(className) {
    return this.adapter.classExists(className);
  }
  purgeCollection(className) {
    return this.loadSchema().then(schemaController => schemaController.getOneSchema(className)).then(schema => this.adapter.deleteObjectsByQuery(className, schema, {}));
  }
  validateClassName(className) {
    if (!SchemaController.classNameIsValid(className)) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_CLASS_NAME, 'invalid className: ' + className));
    }
    return Promise.resolve();
  }

  // Returns a promise for a schemaController.
  loadSchema(options = {
    clearCache: false
  }) {
    if (this.schemaPromise != null) {
      return this.schemaPromise;
    }
    this.schemaPromise = SchemaController.load(this.adapter, options);
    this.schemaPromise.then(() => delete this.schemaPromise, () => delete this.schemaPromise);
    return this.loadSchema(options);
  }
  loadSchemaIfNeeded(schemaController, options = {
    clearCache: false
  }) {
    return schemaController ? Promise.resolve(schemaController) : this.loadSchema(options);
  }

  // Returns a promise for the classname that is related to the given
  // classname through the key.
  // TODO: make this not in the DatabaseController interface
  redirectClassNameForKey(className, key) {
    return this.loadSchema().then(schema => {
      var t = schema.getExpectedType(className, key);
      if (t != null && typeof t !== 'string' && t.type === 'Relation') {
        return t.targetClass;
      }
      return className;
    });
  }

  // Uses the schema to validate the object (REST API format).
  // Returns a promise that resolves to the new schema.
  // This does not update this.schema, because in a situation like a
  // batch request, that could confuse other users of the schema.
  validateObject(className, object, query, runOptions, maintenance) {
    let schema;
    const acl = runOptions.acl;
    const isMaster = acl === undefined;
    var aclGroup = acl || [];
    return this.loadSchema().then(s => {
      schema = s;
      if (isMaster) {
        return Promise.resolve();
      }
      return this.canAddField(schema, className, object, aclGroup, runOptions);
    }).then(() => {
      return schema.validateObject(className, object, query, maintenance);
    });
  }
  update(className, query, update, {
    acl,
    many,
    upsert,
    addsField
  } = {}, skipSanitization = false, validateOnly = false, validSchemaController) {
    try {
      _Utils.default.checkProhibitedKeywords(this.options, update);
    } catch (error) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, error));
    }
    const originalQuery = query;
    const originalUpdate = update;
    // Make a copy of the object, so we don't mutate the incoming data.
    update = (0, _deepcopy.default)(update);
    var relationUpdates = [];
    var isMaster = acl === undefined;
    var aclGroup = acl || [];
    return this.loadSchemaIfNeeded(validSchemaController).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'update')).then(() => {
        relationUpdates = this.collectRelationUpdates(className, originalQuery.objectId, update);
        if (!isMaster) {
          query = this.addPointerPermissions(schemaController, className, 'update', query, aclGroup);
          if (addsField) {
            query = {
              $and: [query, this.addPointerPermissions(schemaController, className, 'addField', query, aclGroup)]
            };
          }
        }
        if (!query) {
          return Promise.resolve();
        }
        if (acl) {
          query = addWriteACL(query, acl);
        }
        validateQuery(query, isMaster, false, true);
        return schemaController.getOneSchema(className, true).catch(error => {
          // If the schema doesn't exist, pretend it exists with no fields. This behavior
          // will likely need revisiting.
          if (error === undefined) {
            return {
              fields: {}
            };
          }
          throw error;
        }).then(schema => {
          Object.keys(update).forEach(fieldName => {
            if (fieldName.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name for update: ${fieldName}`);
            }
            const rootFieldName = getRootFieldName(fieldName);
            if (!SchemaController.fieldNameIsValid(rootFieldName, className) && !isSpecialUpdateKey(rootFieldName)) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name for update: ${fieldName}`);
            }
          });
          for (const updateOperation in update) {
            if (update[updateOperation] && typeof update[updateOperation] === 'object' && Object.keys(update[updateOperation]).some(innerKey => innerKey.includes('$') || innerKey.includes('.'))) {
              throw new _node.Parse.Error(_node.Parse.Error.INVALID_NESTED_KEY, "Nested keys should not contain the '$' or '.' characters");
            }
          }
          update = transformObjectACL(update);
          transformAuthData(className, update, schema);
          if (validateOnly) {
            return this.adapter.find(className, schema, query, {}).then(result => {
              if (!result || !result.length) {
                throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
              }
              return {};
            });
          }
          if (many) {
            return this.adapter.updateObjectsByQuery(className, schema, query, update, this._transactionalSession);
          } else if (upsert) {
            return this.adapter.upsertOneObject(className, schema, query, update, this._transactionalSession);
          } else {
            return this.adapter.findOneAndUpdate(className, schema, query, update, this._transactionalSession);
          }
        });
      }).then(result => {
        if (!result) {
          throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
        }
        if (validateOnly) {
          return result;
        }
        return this.handleRelationUpdates(className, originalQuery.objectId, update, relationUpdates).then(() => {
          return result;
        });
      }).then(result => {
        if (skipSanitization) {
          return Promise.resolve(result);
        }
        return this._sanitizeDatabaseResult(originalUpdate, result);
      });
    });
  }

  // Collect all relation-updating operations from a REST-format update.
  // Returns a list of all relation updates to perform
  // This mutates update.
  collectRelationUpdates(className, objectId, update) {
    var ops = [];
    var deleteMe = [];
    objectId = update.objectId || objectId;
    var process = (op, key) => {
      if (!op) {
        return;
      }
      if (op.__op == 'AddRelation') {
        ops.push({
          key,
          op
        });
        deleteMe.push(key);
      }
      if (op.__op == 'RemoveRelation') {
        ops.push({
          key,
          op
        });
        deleteMe.push(key);
      }
      if (op.__op == 'Batch') {
        for (var x of op.ops) {
          process(x, key);
        }
      }
    };
    for (const key in update) {
      process(update[key], key);
    }
    for (const key of deleteMe) {
      delete update[key];
    }
    return ops;
  }

  // Processes relation-updating operations from a REST-format update.
  // Returns a promise that resolves when all updates have been performed
  handleRelationUpdates(className, objectId, update, ops) {
    var pending = [];
    objectId = update.objectId || objectId;
    ops.forEach(({
      key,
      op
    }) => {
      if (!op) {
        return;
      }
      if (op.__op == 'AddRelation') {
        for (const object of op.objects) {
          pending.push(this.addRelation(key, className, objectId, object.objectId));
        }
      }
      if (op.__op == 'RemoveRelation') {
        for (const object of op.objects) {
          pending.push(this.removeRelation(key, className, objectId, object.objectId));
        }
      }
    });
    return Promise.all(pending);
  }

  // Adds a relation.
  // Returns a promise that resolves successfully iff the add was successful.
  addRelation(key, fromClassName, fromId, toId) {
    const doc = {
      relatedId: toId,
      owningId: fromId
    };
    return this.adapter.upsertOneObject(`_Join:${key}:${fromClassName}`, relationSchema, doc, doc, this._transactionalSession);
  }

  // Removes a relation.
  // Returns a promise that resolves successfully iff the remove was
  // successful.
  removeRelation(key, fromClassName, fromId, toId) {
    var doc = {
      relatedId: toId,
      owningId: fromId
    };
    return this.adapter.deleteObjectsByQuery(`_Join:${key}:${fromClassName}`, relationSchema, doc, this._transactionalSession).catch(error => {
      // We don't care if they try to delete a non-existent relation.
      if (error.code == _node.Parse.Error.OBJECT_NOT_FOUND) {
        return;
      }
      throw error;
    });
  }

  // Removes objects matches this query from the database.
  // Returns a promise that resolves successfully iff the object was
  // deleted.
  // Options:
  //   acl:  a list of strings. If the object to be updated has an ACL,
  //         one of the provided strings must provide the caller with
  //         write permissions.
  destroy(className, query, {
    acl
  } = {}, validSchemaController) {
    const isMaster = acl === undefined;
    const aclGroup = acl || [];
    return this.loadSchemaIfNeeded(validSchemaController).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'delete')).then(() => {
        if (!isMaster) {
          query = this.addPointerPermissions(schemaController, className, 'delete', query, aclGroup);
          if (!query) {
            throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
          }
        }
        // delete by query
        if (acl) {
          query = addWriteACL(query, acl);
        }
        validateQuery(query, isMaster, false, false);
        return schemaController.getOneSchema(className).catch(error => {
          // If the schema doesn't exist, pretend it exists with no fields. This behavior
          // will likely need revisiting.
          if (error === undefined) {
            return {
              fields: {}
            };
          }
          throw error;
        }).then(parseFormatSchema => this.adapter.deleteObjectsByQuery(className, parseFormatSchema, query, this._transactionalSession)).catch(error => {
          // When deleting sessions while changing passwords, don't throw an error if they don't have any sessions.
          if (className === '_Session' && error.code === _node.Parse.Error.OBJECT_NOT_FOUND) {
            return Promise.resolve({});
          }
          throw error;
        });
      });
    });
  }

  // Inserts an object into the database.
  // Returns a promise that resolves successfully iff the object saved.
  create(className, object, {
    acl
  } = {}, validateOnly = false, validSchemaController) {
    try {
      _Utils.default.checkProhibitedKeywords(this.options, object);
    } catch (error) {
      return Promise.reject(new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, error));
    }
    // Make a copy of the object, so we don't mutate the incoming data.
    const originalObject = object;
    object = transformObjectACL(object);
    object.createdAt = {
      iso: object.createdAt,
      __type: 'Date'
    };
    object.updatedAt = {
      iso: object.updatedAt,
      __type: 'Date'
    };
    var isMaster = acl === undefined;
    var aclGroup = acl || [];
    const relationUpdates = this.collectRelationUpdates(className, null, object);
    return this.validateClassName(className).then(() => this.loadSchemaIfNeeded(validSchemaController)).then(schemaController => {
      return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, 'create')).then(() => schemaController.enforceClassExists(className)).then(() => schemaController.getOneSchema(className, true)).then(schema => {
        transformAuthData(className, object, schema);
        flattenUpdateOperatorsForCreate(object);
        if (validateOnly) {
          return {};
        }
        return this.adapter.createObject(className, SchemaController.convertSchemaToAdapterSchema(schema), object, this._transactionalSession);
      }).then(result => {
        if (validateOnly) {
          return originalObject;
        }
        return this.handleRelationUpdates(className, object.objectId, object, relationUpdates).then(() => {
          return this._sanitizeDatabaseResult(originalObject, result.ops[0]);
        });
      });
    });
  }
  canAddField(schema, className, object, aclGroup, runOptions) {
    const classSchema = schema.schemaData[className];
    if (!classSchema) {
      return Promise.resolve();
    }
    const fields = Object.keys(object);
    const schemaFields = Object.keys(classSchema.fields);
    const newKeys = fields.filter(field => {
      // Skip fields that are unset
      if (object[field] && object[field].__op && object[field].__op === 'Delete') {
        return false;
      }
      return schemaFields.indexOf(getRootFieldName(field)) < 0;
    });
    if (newKeys.length > 0) {
      // adds a marker that new field is being adding during update
      runOptions.addsField = true;
      const action = runOptions.action;
      return schema.validatePermission(className, aclGroup, 'addField', action);
    }
    return Promise.resolve();
  }

  // Won't delete collections in the system namespace
  /**
   * Delete all classes and clears the schema cache
   *
   * @param {boolean} fast set to true if it's ok to just delete rows and not indexes
   * @returns {Promise<void>} when the deletions completes
   */
  deleteEverything(fast = false) {
    this.schemaPromise = null;
    _SchemaCache.default.clear();
    return this.adapter.deleteAllClasses(fast);
  }

  // Returns a promise for a list of related ids given an owning id.
  // className here is the owning className.
  relatedIds(className, key, owningId, queryOptions) {
    const {
      skip,
      limit,
      sort
    } = queryOptions;
    const findOptions = {};
    if (sort && sort.createdAt && this.adapter.canSortOnJoinTables) {
      findOptions.sort = {
        _id: sort.createdAt
      };
      findOptions.limit = limit;
      findOptions.skip = skip;
      queryOptions.skip = 0;
    }
    return this.adapter.find(joinTableName(className, key), relationSchema, {
      owningId
    }, findOptions).then(results => results.map(result => result.relatedId));
  }

  // Returns a promise for a list of owning ids given some related ids.
  // className here is the owning className.
  owningIds(className, key, relatedIds) {
    return this.adapter.find(joinTableName(className, key), relationSchema, {
      relatedId: {
        $in: relatedIds
      }
    }, {
      keys: ['owningId']
    }).then(results => results.map(result => result.owningId));
  }

  // Modifies query so that it no longer has $in on relation fields, or
  // equal-to-pointer constraints on relation fields.
  // Returns a promise that resolves when query is mutated
  reduceInRelation(className, query, schema) {
    // Search for an in-relation or equal-to-relation
    // Make it sequential for now, not sure of paralleization side effects
    const promises = [];
    if (query['$or']) {
      const ors = query['$or'];
      promises.push(...ors.map((aQuery, index) => {
        return this.reduceInRelation(className, aQuery, schema).then(aQuery => {
          query['$or'][index] = aQuery;
        });
      }));
    }
    if (query['$and']) {
      const ands = query['$and'];
      promises.push(...ands.map((aQuery, index) => {
        return this.reduceInRelation(className, aQuery, schema).then(aQuery => {
          query['$and'][index] = aQuery;
        });
      }));
    }
    const otherKeys = Object.keys(query).map(key => {
      if (key === '$and' || key === '$or') {
        return;
      }
      const t = schema.getExpectedType(className, key);
      if (!t || t.type !== 'Relation') {
        return Promise.resolve(query);
      }
      let queries = null;
      if (query[key] && (query[key]['$in'] || query[key]['$ne'] || query[key]['$nin'] || query[key].__type == 'Pointer')) {
        // Build the list of queries
        queries = Object.keys(query[key]).map(constraintKey => {
          let relatedIds;
          let isNegation = false;
          if (constraintKey === 'objectId') {
            relatedIds = [query[key].objectId];
          } else if (constraintKey == '$in') {
            relatedIds = query[key]['$in'].map(r => r.objectId);
          } else if (constraintKey == '$nin') {
            isNegation = true;
            relatedIds = query[key]['$nin'].map(r => r.objectId);
          } else if (constraintKey == '$ne') {
            isNegation = true;
            relatedIds = [query[key]['$ne'].objectId];
          } else {
            return;
          }
          return {
            isNegation,
            relatedIds
          };
        });
      } else {
        queries = [{
          isNegation: false,
          relatedIds: []
        }];
      }

      // remove the current queryKey as we don,t need it anymore
      delete query[key];
      // execute each query independently to build the list of
      // $in / $nin
      const promises = queries.map(q => {
        if (!q) {
          return Promise.resolve();
        }
        return this.owningIds(className, key, q.relatedIds).then(ids => {
          if (q.isNegation) {
            this.addNotInObjectIdsIds(ids, query);
          } else {
            this.addInObjectIdsIds(ids, query);
          }
          return Promise.resolve();
        });
      });
      return Promise.all(promises).then(() => {
        return Promise.resolve();
      });
    });
    return Promise.all([...promises, ...otherKeys]).then(() => {
      return Promise.resolve(query);
    });
  }

  // Modifies query so that it no longer has $relatedTo
  // Returns a promise that resolves when query is mutated
  reduceRelationKeys(className, query, queryOptions) {
    if (query['$or']) {
      return Promise.all(query['$or'].map(aQuery => {
        return this.reduceRelationKeys(className, aQuery, queryOptions);
      }));
    }
    if (query['$and']) {
      return Promise.all(query['$and'].map(aQuery => {
        return this.reduceRelationKeys(className, aQuery, queryOptions);
      }));
    }
    var relatedTo = query['$relatedTo'];
    if (relatedTo) {
      return this.relatedIds(relatedTo.object.className, relatedTo.key, relatedTo.object.objectId, queryOptions).then(ids => {
        delete query['$relatedTo'];
        this.addInObjectIdsIds(ids, query);
        return this.reduceRelationKeys(className, query, queryOptions);
      }).then(() => {});
    }
  }
  addInObjectIdsIds(ids = null, query) {
    const idsFromString = typeof query.objectId === 'string' ? [query.objectId] : null;
    const idsFromEq = query.objectId && query.objectId['$eq'] ? [query.objectId['$eq']] : null;
    const idsFromIn = query.objectId && query.objectId['$in'] ? query.objectId['$in'] : null;

    // -disable-next
    const allIds = [idsFromString, idsFromEq, idsFromIn, ids].filter(list => list !== null);
    const totalLength = allIds.reduce((memo, list) => memo + list.length, 0);
    let idsIntersection = [];
    if (totalLength > 125) {
      idsIntersection = _intersect.default.big(allIds);
    } else {
      idsIntersection = (0, _intersect.default)(allIds);
    }

    // Need to make sure we don't clobber existing shorthand $eq constraints on objectId.
    if (!('objectId' in query)) {
      query.objectId = {
        $in: undefined
      };
    } else if (typeof query.objectId === 'string') {
      query.objectId = {
        $in: undefined,
        $eq: query.objectId
      };
    }
    query.objectId['$in'] = idsIntersection;
    return query;
  }
  addNotInObjectIdsIds(ids = [], query) {
    const idsFromNin = query.objectId && query.objectId['$nin'] ? query.objectId['$nin'] : [];
    let allIds = [...idsFromNin, ...ids].filter(list => list !== null);

    // make a set and spread to remove duplicates
    allIds = [...new Set(allIds)];

    // Need to make sure we don't clobber existing shorthand $eq constraints on objectId.
    if (!('objectId' in query)) {
      query.objectId = {
        $nin: undefined
      };
    } else if (typeof query.objectId === 'string') {
      query.objectId = {
        $nin: undefined,
        $eq: query.objectId
      };
    }
    query.objectId['$nin'] = allIds;
    return query;
  }

  // Runs a query on the database.
  // Returns a promise that resolves to a list of items.
  // Options:
  //   skip    number of results to skip.
  //   limit   limit to this number of results.
  //   sort    an object where keys are the fields to sort by.
  //           the value is +1 for ascending, -1 for descending.
  //   count   run a count instead of returning results.
  //   acl     restrict this operation with an ACL for the provided array
  //           of user objectIds and roles. acl: null means no user.
  //           when this field is not present, don't do anything regarding ACLs.
  //  caseInsensitive make string comparisons case insensitive
  // TODO: make userIds not needed here. The db adapter shouldn't know
  // anything about users, ideally. Then, improve the format of the ACL
  // arg to work like the others.
  find(className, query, {
    skip,
    limit,
    acl,
    sort = {},
    count,
    keys,
    op,
    distinct,
    pipeline,
    readPreference,
    hint,
    caseInsensitive = false,
    explain
  } = {}, auth = {}, validSchemaController) {
    const isMaintenance = auth.isMaintenance;
    const isMaster = acl === undefined || isMaintenance;
    const aclGroup = acl || [];
    op = op || (typeof query.objectId == 'string' && Object.keys(query).length === 1 ? 'get' : 'find');
    // Count operation if counting
    op = count === true ? 'count' : op;
    let classExists = true;
    return this.loadSchemaIfNeeded(validSchemaController).then(schemaController => {
      //Allow volatile classes if querying with Master (for _PushStatus)
      //TODO: Move volatile classes concept into mongo adapter, postgres adapter shouldn't care
      //that api.parse.com breaks when _PushStatus exists in mongo.
      return schemaController.getOneSchema(className, isMaster).catch(error => {
        // Behavior for non-existent classes is kinda weird on Parse.com. Probably doesn't matter too much.
        // For now, pretend the class exists but has no objects,
        if (error === undefined) {
          classExists = false;
          return {
            fields: {}
          };
        }
        throw error;
      }).then(schema => {
        // Parse.com treats queries on _created_at and _updated_at as if they were queries on createdAt and updatedAt,
        // so duplicate that behavior here. If both are specified, the correct behavior to match Parse.com is to
        // use the one that appears first in the sort list.
        if (sort._created_at) {
          sort.createdAt = sort._created_at;
          delete sort._created_at;
        }
        if (sort._updated_at) {
          sort.updatedAt = sort._updated_at;
          delete sort._updated_at;
        }
        const queryOptions = {
          skip,
          limit,
          sort,
          keys,
          readPreference,
          hint,
          caseInsensitive,
          explain
        };
        Object.keys(sort).forEach(fieldName => {
          if (fieldName.match(/^authData\.([a-zA-Z0-9_]+)\.id$/)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Cannot sort by ${fieldName}`);
          }
          const rootFieldName = getRootFieldName(fieldName);
          if (!SchemaController.fieldNameIsValid(rootFieldName, className)) {
            throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Invalid field name: ${fieldName}.`);
          }
          if (!schema.fields[fieldName.split('.')[0]] && fieldName !== 'score') {
            delete sort[fieldName];
          }
        });
        return (isMaster ? Promise.resolve() : schemaController.validatePermission(className, aclGroup, op)).then(() => this.reduceRelationKeys(className, query, queryOptions)).then(() => this.reduceInRelation(className, query, schemaController)).then(() => {
          let protectedFields;
          if (!isMaster) {
            query = this.addPointerPermissions(schemaController, className, op, query, aclGroup);
            /* Don't use projections to optimize the protectedFields since the protectedFields
              based on pointer-permissions are determined after querying. The filtering can
              overwrite the protected fields. */
            protectedFields = this.addProtectedFields(schemaController, className, query, aclGroup, auth, queryOptions);
          }
          if (!query) {
            if (op === 'get') {
              throw new _node.Parse.Error(_node.Parse.Error.OBJECT_NOT_FOUND, 'Object not found.');
            } else {
              return [];
            }
          }
          if (!isMaster) {
            if (op === 'update' || op === 'delete') {
              query = addWriteACL(query, aclGroup);
            } else {
              query = addReadACL(query, aclGroup);
            }
          }
          validateQuery(query, isMaster, isMaintenance, false);
          if (count) {
            if (!classExists) {
              return 0;
            } else {
              return this.adapter.count(className, schema, query, readPreference, undefined, hint);
            }
          } else if (distinct) {
            if (!classExists) {
              return [];
            } else {
              return this.adapter.distinct(className, schema, query, distinct);
            }
          } else if (pipeline) {
            if (!classExists) {
              return [];
            } else {
              return this.adapter.aggregate(className, schema, pipeline, readPreference, hint, explain);
            }
          } else if (explain) {
            return this.adapter.find(className, schema, query, queryOptions);
          } else {
            return this.adapter.find(className, schema, query, queryOptions).then(objects => objects.map(object => {
              object = untransformObjectACL(object);
              return filterSensitiveData(isMaster, isMaintenance, aclGroup, auth, op, schemaController, className, protectedFields, object);
            })).catch(error => {
              throw new _node.Parse.Error(_node.Parse.Error.INTERNAL_SERVER_ERROR, error);
            });
          }
        });
      });
    });
  }
  deleteSchema(className) {
    let schemaController;
    return this.loadSchema({
      clearCache: true
    }).then(s => {
      schemaController = s;
      return schemaController.getOneSchema(className, true);
    }).catch(error => {
      if (error === undefined) {
        return {
          fields: {}
        };
      } else {
        throw error;
      }
    }).then(schema => {
      return this.collectionExists(className).then(() => this.adapter.count(className, {
        fields: {}
      }, null, '', false)).then(count => {
        if (count > 0) {
          throw new _node.Parse.Error(255, `Class ${className} is not empty, contains ${count} objects, cannot drop schema.`);
        }
        return this.adapter.deleteClass(className);
      }).then(wasParseCollection => {
        if (wasParseCollection) {
          const relationFieldNames = Object.keys(schema.fields).filter(fieldName => schema.fields[fieldName].type === 'Relation');
          return Promise.all(relationFieldNames.map(name => this.adapter.deleteClass(joinTableName(className, name)))).then(() => {
            _SchemaCache.default.del(className);
            return schemaController.reloadData();
          });
        } else {
          return Promise.resolve();
        }
      });
    });
  }

  // This helps to create intermediate objects for simpler comparison of
  // key value pairs used in query objects. Each key value pair will represented
  // in a similar way to json
  objectToEntriesStrings(query) {
    return Object.entries(query).map(a => a.map(s => JSON.stringify(s)).join(':'));
  }

  // Naive logic reducer for OR operations meant to be used only for pointer permissions.
  reduceOrOperation(query) {
    if (!query.$or) {
      return query;
    }
    const queries = query.$or.map(q => this.objectToEntriesStrings(q));
    let repeat = false;
    do {
      repeat = false;
      for (let i = 0; i < queries.length - 1; i++) {
        for (let j = i + 1; j < queries.length; j++) {
          const [shorter, longer] = queries[i].length > queries[j].length ? [j, i] : [i, j];
          const foundEntries = queries[shorter].reduce((acc, entry) => acc + (queries[longer].includes(entry) ? 1 : 0), 0);
          const shorterEntries = queries[shorter].length;
          if (foundEntries === shorterEntries) {
            // If the shorter query is completely contained in the longer one, we can strike
            // out the longer query.
            query.$or.splice(longer, 1);
            queries.splice(longer, 1);
            repeat = true;
            break;
          }
        }
      }
    } while (repeat);
    if (query.$or.length === 1) {
      query = _objectSpread(_objectSpread({}, query), query.$or[0]);
      delete query.$or;
    }
    return query;
  }

  // Naive logic reducer for AND operations meant to be used only for pointer permissions.
  reduceAndOperation(query) {
    if (!query.$and) {
      return query;
    }
    const queries = query.$and.map(q => this.objectToEntriesStrings(q));
    let repeat = false;
    do {
      repeat = false;
      for (let i = 0; i < queries.length - 1; i++) {
        for (let j = i + 1; j < queries.length; j++) {
          const [shorter, longer] = queries[i].length > queries[j].length ? [j, i] : [i, j];
          const foundEntries = queries[shorter].reduce((acc, entry) => acc + (queries[longer].includes(entry) ? 1 : 0), 0);
          const shorterEntries = queries[shorter].length;
          if (foundEntries === shorterEntries) {
            // If the shorter query is completely contained in the longer one, we can strike
            // out the shorter query.
            query.$and.splice(shorter, 1);
            queries.splice(shorter, 1);
            repeat = true;
            break;
          }
        }
      }
    } while (repeat);
    if (query.$and.length === 1) {
      query = _objectSpread(_objectSpread({}, query), query.$and[0]);
      delete query.$and;
    }
    return query;
  }

  // Constraints query using CLP's pointer permissions (PP) if any.
  // 1. Etract the user id from caller's ACLgroup;
  // 2. Exctract a list of field names that are PP for target collection and operation;
  // 3. Constraint the original query so that each PP field must
  // point to caller's id (or contain it in case of PP field being an array)
  addPointerPermissions(schema, className, operation, query, aclGroup = []) {
    // Check if class has public permission for operation
    // If the BaseCLP pass, let go through
    if (schema.testPermissionsForClassName(className, aclGroup, operation)) {
      return query;
    }
    const perms = schema.getClassLevelPermissions(className);
    const userACL = aclGroup.filter(acl => {
      return acl.indexOf('role:') != 0 && acl != '*';
    });
    const groupKey = ['get', 'find', 'count'].indexOf(operation) > -1 ? 'readUserFields' : 'writeUserFields';
    const permFields = [];
    if (perms[operation] && perms[operation].pointerFields) {
      permFields.push(...perms[operation].pointerFields);
    }
    if (perms[groupKey]) {
      for (const field of perms[groupKey]) {
        if (!permFields.includes(field)) {
          permFields.push(field);
        }
      }
    }
    // the ACL should have exactly 1 user
    if (permFields.length > 0) {
      // the ACL should have exactly 1 user
      // No user set return undefined
      // If the length is > 1, that means we didn't de-dupe users correctly
      if (userACL.length != 1) {
        return;
      }
      const userId = userACL[0];
      const userPointer = {
        __type: 'Pointer',
        className: '_User',
        objectId: userId
      };
      const queries = permFields.map(key => {
        const fieldDescriptor = schema.getExpectedType(className, key);
        const fieldType = fieldDescriptor && typeof fieldDescriptor === 'object' && Object.prototype.hasOwnProperty.call(fieldDescriptor, 'type') ? fieldDescriptor.type : null;
        let queryClause;
        if (fieldType === 'Pointer') {
          // constraint for single pointer setup
          queryClause = {
            [key]: userPointer
          };
        } else if (fieldType === 'Array') {
          // constraint for users-array setup
          queryClause = {
            [key]: {
              $all: [userPointer]
            }
          };
        } else if (fieldType === 'Object') {
          // constraint for object setup
          queryClause = {
            [key]: userPointer
          };
        } else {
          // This means that there is a CLP field of an unexpected type. This condition should not happen, which is
          // why is being treated as an error.
          throw Error(`An unexpected condition occurred when resolving pointer permissions: ${className} ${key}`);
        }
        // if we already have a constraint on the key, use the $and
        if (Object.prototype.hasOwnProperty.call(query, key)) {
          return this.reduceAndOperation({
            $and: [queryClause, query]
          });
        }
        // otherwise just add the constaint
        return Object.assign({}, query, queryClause);
      });
      return queries.length === 1 ? queries[0] : this.reduceOrOperation({
        $or: queries
      });
    } else {
      return query;
    }
  }
  addProtectedFields(schema, className, query = {}, aclGroup = [], auth = {}, queryOptions = {}) {
    const perms = schema && schema.getClassLevelPermissions ? schema.getClassLevelPermissions(className) : schema;
    if (!perms) return null;
    const protectedFields = perms.protectedFields;
    if (!protectedFields) return null;
    if (aclGroup.indexOf(query.objectId) > -1) return null;

    // for queries where "keys" are set and do not include all 'userField':{field},
    // we have to transparently include it, and then remove before returning to client
    // Because if such key not projected the permission won't be enforced properly
    // PS this is called when 'excludeKeys' already reduced to 'keys'
    const preserveKeys = queryOptions.keys;

    // these are keys that need to be included only
    // to be able to apply protectedFields by pointer
    // and then unset before returning to client (later in  filterSensitiveFields)
    const serverOnlyKeys = [];
    const authenticated = auth.user;

    // map to allow check without array search
    const roles = (auth.userRoles || []).reduce((acc, r) => {
      acc[r] = protectedFields[r];
      return acc;
    }, {});

    // array of sets of protected fields. separate item for each applicable criteria
    const protectedKeysSets = [];
    for (const key in protectedFields) {
      // skip userFields
      if (key.startsWith('userField:')) {
        if (preserveKeys) {
          const fieldName = key.substring(10);
          if (!preserveKeys.includes(fieldName)) {
            // 1. put it there temporarily
            queryOptions.keys && queryOptions.keys.push(fieldName);
            // 2. preserve it delete later
            serverOnlyKeys.push(fieldName);
          }
        }
        continue;
      }

      // add public tier
      if (key === '*') {
        protectedKeysSets.push(protectedFields[key]);
        continue;
      }
      if (authenticated) {
        if (key === 'authenticated') {
          // for logged in users
          protectedKeysSets.push(protectedFields[key]);
          continue;
        }
        if (roles[key] && key.startsWith('role:')) {
          // add applicable roles
          protectedKeysSets.push(roles[key]);
        }
      }
    }

    // check if there's a rule for current user's id
    if (authenticated) {
      const userId = auth.user.id;
      if (perms.protectedFields[userId]) {
        protectedKeysSets.push(perms.protectedFields[userId]);
      }
    }

    // preserve fields to be removed before sending response to client
    if (serverOnlyKeys.length > 0) {
      perms.protectedFields.temporaryKeys = serverOnlyKeys;
    }
    let protectedKeys = protectedKeysSets.reduce((acc, next) => {
      if (next) {
        acc.push(...next);
      }
      return acc;
    }, []);

    // intersect all sets of protectedFields
    protectedKeysSets.forEach(fields => {
      if (fields) {
        protectedKeys = protectedKeys.filter(v => fields.includes(v));
      }
    });
    return protectedKeys;
  }
  createTransactionalSession() {
    return this.adapter.createTransactionalSession().then(transactionalSession => {
      this._transactionalSession = transactionalSession;
    });
  }
  commitTransactionalSession() {
    if (!this._transactionalSession) {
      throw new Error('There is no transactional session to commit');
    }
    return this.adapter.commitTransactionalSession(this._transactionalSession).then(() => {
      this._transactionalSession = null;
    });
  }
  abortTransactionalSession() {
    if (!this._transactionalSession) {
      throw new Error('There is no transactional session to abort');
    }
    return this.adapter.abortTransactionalSession(this._transactionalSession).then(() => {
      this._transactionalSession = null;
    });
  }

  // TODO: create indexes on first creation of a _User object. Otherwise it's impossible to
  // have a Parse app without it having a _User collection.
  async performInitialization() {
    await this.adapter.performInitialization({
      VolatileClassesSchemas: SchemaController.VolatileClassesSchemas
    });
    const requiredUserFields = {
      fields: _objectSpread(_objectSpread({}, SchemaController.defaultColumns._Default), SchemaController.defaultColumns._User)
    };
    const requiredRoleFields = {
      fields: _objectSpread(_objectSpread({}, SchemaController.defaultColumns._Default), SchemaController.defaultColumns._Role)
    };
    const requiredIdempotencyFields = {
      fields: _objectSpread(_objectSpread({}, SchemaController.defaultColumns._Default), SchemaController.defaultColumns._Idempotency)
    };
    await this.loadSchema().then(schema => schema.enforceClassExists('_User'));
    await this.loadSchema().then(schema => schema.enforceClassExists('_Role'));
    await this.loadSchema().then(schema => schema.enforceClassExists('_Idempotency'));
    await this.adapter.ensureUniqueness('_User', requiredUserFields, ['username']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for usernames: ', error);
      throw error;
    });
    await this.adapter.ensureIndex('_User', requiredUserFields, ['username'], 'case_insensitive_username', true).catch(error => {
      _logger.default.warn('Unable to create case insensitive username index: ', error);
      throw error;
    });
    await this.adapter.ensureUniqueness('_User', requiredUserFields, ['email']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for user email addresses: ', error);
      throw error;
    });
    await this.adapter.ensureIndex('_User', requiredUserFields, ['email'], 'case_insensitive_email', true).catch(error => {
      _logger.default.warn('Unable to create case insensitive email index: ', error);
      throw error;
    });
    await this.adapter.ensureUniqueness('_Role', requiredRoleFields, ['name']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for role name: ', error);
      throw error;
    });
    await this.adapter.ensureUniqueness('_Idempotency', requiredIdempotencyFields, ['reqId']).catch(error => {
      _logger.default.warn('Unable to ensure uniqueness for idempotency request ID: ', error);
      throw error;
    });
    const isMongoAdapter = this.adapter instanceof _MongoStorageAdapter.default;
    const isPostgresAdapter = this.adapter instanceof _PostgresStorageAdapter.default;
    if (isMongoAdapter || isPostgresAdapter) {
      let options = {};
      if (isMongoAdapter) {
        options = {
          ttl: 0
        };
      } else if (isPostgresAdapter) {
        options = this.idempotencyOptions;
        options.setIdempotencyFunction = true;
      }
      await this.adapter.ensureIndex('_Idempotency', requiredIdempotencyFields, ['expire'], 'ttl', false, options).catch(error => {
        _logger.default.warn('Unable to create TTL index for idempotency expire date: ', error);
        throw error;
      });
    }
    await this.adapter.updateSchemaWithIndexes();
  }
  _expandResultOnKeyPath(object, key, value) {
    if (key.indexOf('.') < 0) {
      object[key] = value[key];
      return object;
    }
    const path = key.split('.');
    const firstKey = path[0];
    const nextPath = path.slice(1).join('.');

    // Scan request data for denied keywords
    if (this.options && this.options.requestKeywordDenylist) {
      // Scan request data for denied keywords
      for (const keyword of this.options.requestKeywordDenylist) {
        const match = _Utils.default.objectContainsKeyValue({
          [firstKey]: true,
          [nextPath]: true
        }, keyword.key, true);
        if (match) {
          throw new _node.Parse.Error(_node.Parse.Error.INVALID_KEY_NAME, `Prohibited keyword in request data: ${JSON.stringify(keyword)}.`);
        }
      }
    }
    object[firstKey] = this._expandResultOnKeyPath(object[firstKey] || {}, nextPath, value[firstKey]);
    delete object[key];
    return object;
  }
  _sanitizeDatabaseResult(originalObject, result) {
    const response = {};
    if (!result) {
      return Promise.resolve(response);
    }
    Object.keys(originalObject).forEach(key => {
      const keyUpdate = originalObject[key];
      // determine if that was an op
      if (keyUpdate && typeof keyUpdate === 'object' && keyUpdate.__op && ['Add', 'AddUnique', 'Remove', 'Increment'].indexOf(keyUpdate.__op) > -1) {
        // only valid ops that produce an actionable result
        // the op may have happened on a keypath
        this._expandResultOnKeyPath(response, key, result);
      }
    });
    return Promise.resolve(response);
  }
}
module.exports = DatabaseController;
// Expose validateQuery for tests
module.exports._validateQuery = validateQuery;
module.exports.filterSensitiveData = filterSensitiveData;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJhZGRXcml0ZUFDTCIsInF1ZXJ5IiwiYWNsIiwibmV3UXVlcnkiLCJfIiwiY2xvbmVEZWVwIiwiX3dwZXJtIiwiJGluIiwiYWRkUmVhZEFDTCIsIl9ycGVybSIsInRyYW5zZm9ybU9iamVjdEFDTCIsIkFDTCIsInJlc3VsdCIsImVudHJ5IiwicmVhZCIsInB1c2giLCJ3cml0ZSIsInNwZWNpYWxRdWVyeUtleXMiLCJzcGVjaWFsTWFzdGVyUXVlcnlLZXlzIiwidmFsaWRhdGVRdWVyeSIsImlzTWFzdGVyIiwiaXNNYWludGVuYW5jZSIsInVwZGF0ZSIsIlBhcnNlIiwiRXJyb3IiLCJJTlZBTElEX1FVRVJZIiwiJG9yIiwiQXJyYXkiLCJmb3JFYWNoIiwidmFsdWUiLCIkYW5kIiwiJG5vciIsImxlbmd0aCIsIk9iamVjdCIsImtleXMiLCJrZXkiLCIkcmVnZXgiLCIkb3B0aW9ucyIsIm1hdGNoIiwiaW5jbHVkZXMiLCJJTlZBTElEX0tFWV9OQU1FIiwiZmlsdGVyU2Vuc2l0aXZlRGF0YSIsImFjbEdyb3VwIiwiYXV0aCIsIm9wZXJhdGlvbiIsInNjaGVtYSIsImNsYXNzTmFtZSIsInByb3RlY3RlZEZpZWxkcyIsIm9iamVjdCIsInVzZXJJZCIsInVzZXIiLCJpZCIsInBlcm1zIiwiZ2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zIiwiaXNSZWFkT3BlcmF0aW9uIiwiaW5kZXhPZiIsInByb3RlY3RlZEZpZWxkc1BvaW50ZXJQZXJtIiwiZmlsdGVyIiwic3RhcnRzV2l0aCIsIm1hcCIsInN1YnN0cmluZyIsIm5ld1Byb3RlY3RlZEZpZWxkcyIsIm92ZXJyaWRlUHJvdGVjdGVkRmllbGRzIiwicG9pbnRlclBlcm0iLCJwb2ludGVyUGVybUluY2x1ZGVzVXNlciIsInJlYWRVc2VyRmllbGRWYWx1ZSIsImlzQXJyYXkiLCJzb21lIiwib2JqZWN0SWQiLCJmaWVsZHMiLCJ2IiwiaXNVc2VyQ2xhc3MiLCJwYXNzd29yZCIsIl9oYXNoZWRfcGFzc3dvcmQiLCJzZXNzaW9uVG9rZW4iLCJrIiwidGVtcG9yYXJ5S2V5cyIsImNoYXJBdCIsImF1dGhEYXRhIiwic3BlY2lhbEtleXNGb3JVcGRhdGUiLCJpc1NwZWNpYWxVcGRhdGVLZXkiLCJqb2luVGFibGVOYW1lIiwiZmxhdHRlblVwZGF0ZU9wZXJhdG9yc0ZvckNyZWF0ZSIsIl9fb3AiLCJhbW91bnQiLCJJTlZBTElEX0pTT04iLCJvYmplY3RzIiwiQ09NTUFORF9VTkFWQUlMQUJMRSIsInRyYW5zZm9ybUF1dGhEYXRhIiwicHJvdmlkZXIiLCJwcm92aWRlckRhdGEiLCJmaWVsZE5hbWUiLCJ0eXBlIiwidW50cmFuc2Zvcm1PYmplY3RBQ0wiLCJvdXRwdXQiLCJnZXRSb290RmllbGROYW1lIiwic3BsaXQiLCJyZWxhdGlvblNjaGVtYSIsInJlbGF0ZWRJZCIsIm93bmluZ0lkIiwiRGF0YWJhc2VDb250cm9sbGVyIiwiY29uc3RydWN0b3IiLCJhZGFwdGVyIiwib3B0aW9ucyIsImlkZW1wb3RlbmN5T3B0aW9ucyIsInNjaGVtYVByb21pc2UiLCJfdHJhbnNhY3Rpb25hbFNlc3Npb24iLCJjb2xsZWN0aW9uRXhpc3RzIiwiY2xhc3NFeGlzdHMiLCJwdXJnZUNvbGxlY3Rpb24iLCJsb2FkU2NoZW1hIiwidGhlbiIsInNjaGVtYUNvbnRyb2xsZXIiLCJnZXRPbmVTY2hlbWEiLCJkZWxldGVPYmplY3RzQnlRdWVyeSIsInZhbGlkYXRlQ2xhc3NOYW1lIiwiU2NoZW1hQ29udHJvbGxlciIsImNsYXNzTmFtZUlzVmFsaWQiLCJQcm9taXNlIiwicmVqZWN0IiwiSU5WQUxJRF9DTEFTU19OQU1FIiwicmVzb2x2ZSIsImNsZWFyQ2FjaGUiLCJsb2FkIiwibG9hZFNjaGVtYUlmTmVlZGVkIiwicmVkaXJlY3RDbGFzc05hbWVGb3JLZXkiLCJ0IiwiZ2V0RXhwZWN0ZWRUeXBlIiwidGFyZ2V0Q2xhc3MiLCJ2YWxpZGF0ZU9iamVjdCIsInJ1bk9wdGlvbnMiLCJtYWludGVuYW5jZSIsInVuZGVmaW5lZCIsInMiLCJjYW5BZGRGaWVsZCIsIm1hbnkiLCJ1cHNlcnQiLCJhZGRzRmllbGQiLCJza2lwU2FuaXRpemF0aW9uIiwidmFsaWRhdGVPbmx5IiwidmFsaWRTY2hlbWFDb250cm9sbGVyIiwiVXRpbHMiLCJjaGVja1Byb2hpYml0ZWRLZXl3b3JkcyIsImVycm9yIiwib3JpZ2luYWxRdWVyeSIsIm9yaWdpbmFsVXBkYXRlIiwiZGVlcGNvcHkiLCJyZWxhdGlvblVwZGF0ZXMiLCJ2YWxpZGF0ZVBlcm1pc3Npb24iLCJjb2xsZWN0UmVsYXRpb25VcGRhdGVzIiwiYWRkUG9pbnRlclBlcm1pc3Npb25zIiwiY2F0Y2giLCJyb290RmllbGROYW1lIiwiZmllbGROYW1lSXNWYWxpZCIsInVwZGF0ZU9wZXJhdGlvbiIsImlubmVyS2V5IiwiSU5WQUxJRF9ORVNURURfS0VZIiwiZmluZCIsIk9CSkVDVF9OT1RfRk9VTkQiLCJ1cGRhdGVPYmplY3RzQnlRdWVyeSIsInVwc2VydE9uZU9iamVjdCIsImZpbmRPbmVBbmRVcGRhdGUiLCJoYW5kbGVSZWxhdGlvblVwZGF0ZXMiLCJfc2FuaXRpemVEYXRhYmFzZVJlc3VsdCIsIm9wcyIsImRlbGV0ZU1lIiwicHJvY2VzcyIsIm9wIiwieCIsInBlbmRpbmciLCJhZGRSZWxhdGlvbiIsInJlbW92ZVJlbGF0aW9uIiwiYWxsIiwiZnJvbUNsYXNzTmFtZSIsImZyb21JZCIsInRvSWQiLCJkb2MiLCJjb2RlIiwiZGVzdHJveSIsInBhcnNlRm9ybWF0U2NoZW1hIiwiY3JlYXRlIiwib3JpZ2luYWxPYmplY3QiLCJjcmVhdGVkQXQiLCJpc28iLCJfX3R5cGUiLCJ1cGRhdGVkQXQiLCJlbmZvcmNlQ2xhc3NFeGlzdHMiLCJjcmVhdGVPYmplY3QiLCJjb252ZXJ0U2NoZW1hVG9BZGFwdGVyU2NoZW1hIiwiY2xhc3NTY2hlbWEiLCJzY2hlbWFEYXRhIiwic2NoZW1hRmllbGRzIiwibmV3S2V5cyIsImZpZWxkIiwiYWN0aW9uIiwiZGVsZXRlRXZlcnl0aGluZyIsImZhc3QiLCJTY2hlbWFDYWNoZSIsImNsZWFyIiwiZGVsZXRlQWxsQ2xhc3NlcyIsInJlbGF0ZWRJZHMiLCJxdWVyeU9wdGlvbnMiLCJza2lwIiwibGltaXQiLCJzb3J0IiwiZmluZE9wdGlvbnMiLCJjYW5Tb3J0T25Kb2luVGFibGVzIiwiX2lkIiwicmVzdWx0cyIsIm93bmluZ0lkcyIsInJlZHVjZUluUmVsYXRpb24iLCJwcm9taXNlcyIsIm9ycyIsImFRdWVyeSIsImluZGV4IiwiYW5kcyIsIm90aGVyS2V5cyIsInF1ZXJpZXMiLCJjb25zdHJhaW50S2V5IiwiaXNOZWdhdGlvbiIsInIiLCJxIiwiaWRzIiwiYWRkTm90SW5PYmplY3RJZHNJZHMiLCJhZGRJbk9iamVjdElkc0lkcyIsInJlZHVjZVJlbGF0aW9uS2V5cyIsInJlbGF0ZWRUbyIsImlkc0Zyb21TdHJpbmciLCJpZHNGcm9tRXEiLCJpZHNGcm9tSW4iLCJhbGxJZHMiLCJsaXN0IiwidG90YWxMZW5ndGgiLCJyZWR1Y2UiLCJtZW1vIiwiaWRzSW50ZXJzZWN0aW9uIiwiaW50ZXJzZWN0IiwiYmlnIiwiJGVxIiwiaWRzRnJvbU5pbiIsIlNldCIsIiRuaW4iLCJjb3VudCIsImRpc3RpbmN0IiwicGlwZWxpbmUiLCJyZWFkUHJlZmVyZW5jZSIsImhpbnQiLCJjYXNlSW5zZW5zaXRpdmUiLCJleHBsYWluIiwiX2NyZWF0ZWRfYXQiLCJfdXBkYXRlZF9hdCIsImFkZFByb3RlY3RlZEZpZWxkcyIsImFnZ3JlZ2F0ZSIsIklOVEVSTkFMX1NFUlZFUl9FUlJPUiIsImRlbGV0ZVNjaGVtYSIsImRlbGV0ZUNsYXNzIiwid2FzUGFyc2VDb2xsZWN0aW9uIiwicmVsYXRpb25GaWVsZE5hbWVzIiwibmFtZSIsImRlbCIsInJlbG9hZERhdGEiLCJvYmplY3RUb0VudHJpZXNTdHJpbmdzIiwiZW50cmllcyIsImEiLCJKU09OIiwic3RyaW5naWZ5Iiwiam9pbiIsInJlZHVjZU9yT3BlcmF0aW9uIiwicmVwZWF0IiwiaSIsImoiLCJzaG9ydGVyIiwibG9uZ2VyIiwiZm91bmRFbnRyaWVzIiwiYWNjIiwic2hvcnRlckVudHJpZXMiLCJzcGxpY2UiLCJyZWR1Y2VBbmRPcGVyYXRpb24iLCJ0ZXN0UGVybWlzc2lvbnNGb3JDbGFzc05hbWUiLCJ1c2VyQUNMIiwiZ3JvdXBLZXkiLCJwZXJtRmllbGRzIiwicG9pbnRlckZpZWxkcyIsInVzZXJQb2ludGVyIiwiZmllbGREZXNjcmlwdG9yIiwiZmllbGRUeXBlIiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwicXVlcnlDbGF1c2UiLCIkYWxsIiwiYXNzaWduIiwicHJlc2VydmVLZXlzIiwic2VydmVyT25seUtleXMiLCJhdXRoZW50aWNhdGVkIiwicm9sZXMiLCJ1c2VyUm9sZXMiLCJwcm90ZWN0ZWRLZXlzU2V0cyIsInByb3RlY3RlZEtleXMiLCJuZXh0IiwiY3JlYXRlVHJhbnNhY3Rpb25hbFNlc3Npb24iLCJ0cmFuc2FjdGlvbmFsU2Vzc2lvbiIsImNvbW1pdFRyYW5zYWN0aW9uYWxTZXNzaW9uIiwiYWJvcnRUcmFuc2FjdGlvbmFsU2Vzc2lvbiIsInBlcmZvcm1Jbml0aWFsaXphdGlvbiIsIlZvbGF0aWxlQ2xhc3Nlc1NjaGVtYXMiLCJyZXF1aXJlZFVzZXJGaWVsZHMiLCJkZWZhdWx0Q29sdW1ucyIsIl9EZWZhdWx0IiwiX1VzZXIiLCJyZXF1aXJlZFJvbGVGaWVsZHMiLCJfUm9sZSIsInJlcXVpcmVkSWRlbXBvdGVuY3lGaWVsZHMiLCJfSWRlbXBvdGVuY3kiLCJlbnN1cmVVbmlxdWVuZXNzIiwibG9nZ2VyIiwid2FybiIsImVuc3VyZUluZGV4IiwiaXNNb25nb0FkYXB0ZXIiLCJNb25nb1N0b3JhZ2VBZGFwdGVyIiwiaXNQb3N0Z3Jlc0FkYXB0ZXIiLCJQb3N0Z3Jlc1N0b3JhZ2VBZGFwdGVyIiwidHRsIiwic2V0SWRlbXBvdGVuY3lGdW5jdGlvbiIsInVwZGF0ZVNjaGVtYVdpdGhJbmRleGVzIiwiX2V4cGFuZFJlc3VsdE9uS2V5UGF0aCIsInBhdGgiLCJmaXJzdEtleSIsIm5leHRQYXRoIiwic2xpY2UiLCJyZXF1ZXN0S2V5d29yZERlbnlsaXN0Iiwia2V5d29yZCIsIm9iamVjdENvbnRhaW5zS2V5VmFsdWUiLCJyZXNwb25zZSIsImtleVVwZGF0ZSIsIm1vZHVsZSIsImV4cG9ydHMiLCJfdmFsaWRhdGVRdWVyeSJdLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9Db250cm9sbGVycy9EYXRhYmFzZUNvbnRyb2xsZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsi77u/Ly8gQGZsb3dcbi8vIEEgZGF0YWJhc2UgYWRhcHRlciB0aGF0IHdvcmtzIHdpdGggZGF0YSBleHBvcnRlZCBmcm9tIHRoZSBob3N0ZWRcbi8vIFBhcnNlIGRhdGFiYXNlLlxuXG4vLyBAZmxvdy1kaXNhYmxlLW5leHRcbmltcG9ydCB7IFBhcnNlIH0gZnJvbSAncGFyc2Uvbm9kZSc7XG4vLyBAZmxvdy1kaXNhYmxlLW5leHRcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG4vLyBAZmxvdy1kaXNhYmxlLW5leHRcbmltcG9ydCBpbnRlcnNlY3QgZnJvbSAnaW50ZXJzZWN0Jztcbi8vIEBmbG93LWRpc2FibGUtbmV4dFxuaW1wb3J0IGRlZXBjb3B5IGZyb20gJ2RlZXBjb3B5JztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi4vbG9nZ2VyJztcbmltcG9ydCBVdGlscyBmcm9tICcuLi9VdGlscyc7XG5pbXBvcnQgKiBhcyBTY2hlbWFDb250cm9sbGVyIGZyb20gJy4vU2NoZW1hQ29udHJvbGxlcic7XG5pbXBvcnQgeyBTdG9yYWdlQWRhcHRlciB9IGZyb20gJy4uL0FkYXB0ZXJzL1N0b3JhZ2UvU3RvcmFnZUFkYXB0ZXInO1xuaW1wb3J0IE1vbmdvU3RvcmFnZUFkYXB0ZXIgZnJvbSAnLi4vQWRhcHRlcnMvU3RvcmFnZS9Nb25nby9Nb25nb1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCBQb3N0Z3Jlc1N0b3JhZ2VBZGFwdGVyIGZyb20gJy4uL0FkYXB0ZXJzL1N0b3JhZ2UvUG9zdGdyZXMvUG9zdGdyZXNTdG9yYWdlQWRhcHRlcic7XG5pbXBvcnQgU2NoZW1hQ2FjaGUgZnJvbSAnLi4vQWRhcHRlcnMvQ2FjaGUvU2NoZW1hQ2FjaGUnO1xuaW1wb3J0IHR5cGUgeyBMb2FkU2NoZW1hT3B0aW9ucyB9IGZyb20gJy4vdHlwZXMnO1xuaW1wb3J0IHR5cGUgeyBQYXJzZVNlcnZlck9wdGlvbnMgfSBmcm9tICcuLi9PcHRpb25zJztcbmltcG9ydCB0eXBlIHsgUXVlcnlPcHRpb25zLCBGdWxsUXVlcnlPcHRpb25zIH0gZnJvbSAnLi4vQWRhcHRlcnMvU3RvcmFnZS9TdG9yYWdlQWRhcHRlcic7XG5cbmZ1bmN0aW9uIGFkZFdyaXRlQUNMKHF1ZXJ5LCBhY2wpIHtcbiAgY29uc3QgbmV3UXVlcnkgPSBfLmNsb25lRGVlcChxdWVyeSk7XG4gIC8vQ2FuJ3QgYmUgYW55IGV4aXN0aW5nICdfd3Blcm0nIHF1ZXJ5LCB3ZSBkb24ndCBhbGxvdyBjbGllbnQgcXVlcmllcyBvbiB0aGF0LCBubyBuZWVkIHRvICRhbmRcbiAgbmV3UXVlcnkuX3dwZXJtID0geyAkaW46IFtudWxsLCAuLi5hY2xdIH07XG4gIHJldHVybiBuZXdRdWVyeTtcbn1cblxuZnVuY3Rpb24gYWRkUmVhZEFDTChxdWVyeSwgYWNsKSB7XG4gIGNvbnN0IG5ld1F1ZXJ5ID0gXy5jbG9uZURlZXAocXVlcnkpO1xuICAvL0Nhbid0IGJlIGFueSBleGlzdGluZyAnX3JwZXJtJyBxdWVyeSwgd2UgZG9uJ3QgYWxsb3cgY2xpZW50IHF1ZXJpZXMgb24gdGhhdCwgbm8gbmVlZCB0byAkYW5kXG4gIG5ld1F1ZXJ5Ll9ycGVybSA9IHsgJGluOiBbbnVsbCwgJyonLCAuLi5hY2xdIH07XG4gIHJldHVybiBuZXdRdWVyeTtcbn1cblxuLy8gVHJhbnNmb3JtcyBhIFJFU1QgQVBJIGZvcm1hdHRlZCBBQ0wgb2JqZWN0IHRvIG91ciB0d28tZmllbGQgbW9uZ28gZm9ybWF0LlxuY29uc3QgdHJhbnNmb3JtT2JqZWN0QUNMID0gKHsgQUNMLCAuLi5yZXN1bHQgfSkgPT4ge1xuICBpZiAoIUFDTCkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICByZXN1bHQuX3dwZXJtID0gW107XG4gIHJlc3VsdC5fcnBlcm0gPSBbXTtcblxuICBmb3IgKGNvbnN0IGVudHJ5IGluIEFDTCkge1xuICAgIGlmIChBQ0xbZW50cnldLnJlYWQpIHtcbiAgICAgIHJlc3VsdC5fcnBlcm0ucHVzaChlbnRyeSk7XG4gICAgfVxuICAgIGlmIChBQ0xbZW50cnldLndyaXRlKSB7XG4gICAgICByZXN1bHQuX3dwZXJtLnB1c2goZW50cnkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3Qgc3BlY2lhbFF1ZXJ5S2V5cyA9IFsnJGFuZCcsICckb3InLCAnJG5vcicsICdfcnBlcm0nLCAnX3dwZXJtJ107XG5jb25zdCBzcGVjaWFsTWFzdGVyUXVlcnlLZXlzID0gW1xuICAuLi5zcGVjaWFsUXVlcnlLZXlzLFxuICAnX2VtYWlsX3ZlcmlmeV90b2tlbicsXG4gICdfcGVyaXNoYWJsZV90b2tlbicsXG4gICdfdG9tYnN0b25lJyxcbiAgJ19lbWFpbF92ZXJpZnlfdG9rZW5fZXhwaXJlc19hdCcsXG4gICdfZmFpbGVkX2xvZ2luX2NvdW50JyxcbiAgJ19hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCcsXG4gICdfcGFzc3dvcmRfY2hhbmdlZF9hdCcsXG4gICdfcGFzc3dvcmRfaGlzdG9yeScsXG5dO1xuXG5jb25zdCB2YWxpZGF0ZVF1ZXJ5ID0gKFxuICBxdWVyeTogYW55LFxuICBpc01hc3RlcjogYm9vbGVhbixcbiAgaXNNYWludGVuYW5jZTogYm9vbGVhbixcbiAgdXBkYXRlOiBib29sZWFuXG4pOiB2b2lkID0+IHtcbiAgaWYgKGlzTWFpbnRlbmFuY2UpIHtcbiAgICBpc01hc3RlciA9IHRydWU7XG4gIH1cbiAgaWYgKHF1ZXJ5LkFDTCkge1xuICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLCAnQ2Fubm90IHF1ZXJ5IG9uIEFDTC4nKTtcbiAgfVxuXG4gIGlmIChxdWVyeS4kb3IpIHtcbiAgICBpZiAocXVlcnkuJG9yIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHF1ZXJ5LiRvci5mb3JFYWNoKHZhbHVlID0+IHZhbGlkYXRlUXVlcnkodmFsdWUsIGlzTWFzdGVyLCBpc01haW50ZW5hbmNlLCB1cGRhdGUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfUVVFUlksICdCYWQgJG9yIGZvcm1hdCAtIHVzZSBhbiBhcnJheSB2YWx1ZS4nKTtcbiAgICB9XG4gIH1cblxuICBpZiAocXVlcnkuJGFuZCkge1xuICAgIGlmIChxdWVyeS4kYW5kIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgIHF1ZXJ5LiRhbmQuZm9yRWFjaCh2YWx1ZSA9PiB2YWxpZGF0ZVF1ZXJ5KHZhbHVlLCBpc01hc3RlciwgaXNNYWludGVuYW5jZSwgdXBkYXRlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX1FVRVJZLCAnQmFkICRhbmQgZm9ybWF0IC0gdXNlIGFuIGFycmF5IHZhbHVlLicpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChxdWVyeS4kbm9yKSB7XG4gICAgaWYgKHF1ZXJ5LiRub3IgaW5zdGFuY2VvZiBBcnJheSAmJiBxdWVyeS4kbm9yLmxlbmd0aCA+IDApIHtcbiAgICAgIHF1ZXJ5LiRub3IuZm9yRWFjaCh2YWx1ZSA9PiB2YWxpZGF0ZVF1ZXJ5KHZhbHVlLCBpc01hc3RlciwgaXNNYWludGVuYW5jZSwgdXBkYXRlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9RVUVSWSxcbiAgICAgICAgJ0JhZCAkbm9yIGZvcm1hdCAtIHVzZSBhbiBhcnJheSBvZiBhdCBsZWFzdCAxIHZhbHVlLidcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgT2JqZWN0LmtleXMocXVlcnkpLmZvckVhY2goa2V5ID0+IHtcbiAgICBpZiAocXVlcnkgJiYgcXVlcnlba2V5XSAmJiBxdWVyeVtrZXldLiRyZWdleCkge1xuICAgICAgaWYgKHR5cGVvZiBxdWVyeVtrZXldLiRvcHRpb25zID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoIXF1ZXJ5W2tleV0uJG9wdGlvbnMubWF0Y2goL15baW14c10rJC8pKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9RVUVSWSxcbiAgICAgICAgICAgIGBCYWQgJG9wdGlvbnMgdmFsdWUgZm9yIHF1ZXJ5OiAke3F1ZXJ5W2tleV0uJG9wdGlvbnN9YFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKFxuICAgICAgIWtleS5tYXRjaCgvXlthLXpBLVpdW2EtekEtWjAtOV9cXC5dKiQvKSAmJlxuICAgICAgKCghc3BlY2lhbFF1ZXJ5S2V5cy5pbmNsdWRlcyhrZXkpICYmICFpc01hc3RlciAmJiAhdXBkYXRlKSB8fFxuICAgICAgICAodXBkYXRlICYmIGlzTWFzdGVyICYmICFzcGVjaWFsTWFzdGVyUXVlcnlLZXlzLmluY2x1ZGVzKGtleSkpKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsIGBJbnZhbGlkIGtleSBuYW1lOiAke2tleX1gKTtcbiAgICB9XG4gIH0pO1xufTtcblxuLy8gRmlsdGVycyBvdXQgYW55IGRhdGEgdGhhdCBzaG91bGRuJ3QgYmUgb24gdGhpcyBSRVNULWZvcm1hdHRlZCBvYmplY3QuXG5jb25zdCBmaWx0ZXJTZW5zaXRpdmVEYXRhID0gKFxuICBpc01hc3RlcjogYm9vbGVhbixcbiAgaXNNYWludGVuYW5jZTogYm9vbGVhbixcbiAgYWNsR3JvdXA6IGFueVtdLFxuICBhdXRoOiBhbnksXG4gIG9wZXJhdGlvbjogYW55LFxuICBzY2hlbWE6IFNjaGVtYUNvbnRyb2xsZXIuU2NoZW1hQ29udHJvbGxlciB8IGFueSxcbiAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gIHByb3RlY3RlZEZpZWxkczogbnVsbCB8IEFycmF5PGFueT4sXG4gIG9iamVjdDogYW55XG4pID0+IHtcbiAgbGV0IHVzZXJJZCA9IG51bGw7XG4gIGlmIChhdXRoICYmIGF1dGgudXNlcikgdXNlcklkID0gYXV0aC51c2VyLmlkO1xuXG4gIC8vIHJlcGxhY2UgcHJvdGVjdGVkRmllbGRzIHdoZW4gdXNpbmcgcG9pbnRlci1wZXJtaXNzaW9uc1xuICBjb25zdCBwZXJtcyA9XG4gICAgc2NoZW1hICYmIHNjaGVtYS5nZXRDbGFzc0xldmVsUGVybWlzc2lvbnMgPyBzY2hlbWEuZ2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zKGNsYXNzTmFtZSkgOiB7fTtcbiAgaWYgKHBlcm1zKSB7XG4gICAgY29uc3QgaXNSZWFkT3BlcmF0aW9uID0gWydnZXQnLCAnZmluZCddLmluZGV4T2Yob3BlcmF0aW9uKSA+IC0xO1xuXG4gICAgaWYgKGlzUmVhZE9wZXJhdGlvbiAmJiBwZXJtcy5wcm90ZWN0ZWRGaWVsZHMpIHtcbiAgICAgIC8vIGV4dHJhY3QgcHJvdGVjdGVkRmllbGRzIGFkZGVkIHdpdGggdGhlIHBvaW50ZXItcGVybWlzc2lvbiBwcmVmaXhcbiAgICAgIGNvbnN0IHByb3RlY3RlZEZpZWxkc1BvaW50ZXJQZXJtID0gT2JqZWN0LmtleXMocGVybXMucHJvdGVjdGVkRmllbGRzKVxuICAgICAgICAuZmlsdGVyKGtleSA9PiBrZXkuc3RhcnRzV2l0aCgndXNlckZpZWxkOicpKVxuICAgICAgICAubWFwKGtleSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHsga2V5OiBrZXkuc3Vic3RyaW5nKDEwKSwgdmFsdWU6IHBlcm1zLnByb3RlY3RlZEZpZWxkc1trZXldIH07XG4gICAgICAgIH0pO1xuXG4gICAgICBjb25zdCBuZXdQcm90ZWN0ZWRGaWVsZHM6IEFycmF5PHN0cmluZz5bXSA9IFtdO1xuICAgICAgbGV0IG92ZXJyaWRlUHJvdGVjdGVkRmllbGRzID0gZmFsc2U7XG5cbiAgICAgIC8vIGNoZWNrIGlmIHRoZSBvYmplY3QgZ3JhbnRzIHRoZSBjdXJyZW50IHVzZXIgYWNjZXNzIGJhc2VkIG9uIHRoZSBleHRyYWN0ZWQgZmllbGRzXG4gICAgICBwcm90ZWN0ZWRGaWVsZHNQb2ludGVyUGVybS5mb3JFYWNoKHBvaW50ZXJQZXJtID0+IHtcbiAgICAgICAgbGV0IHBvaW50ZXJQZXJtSW5jbHVkZXNVc2VyID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IHJlYWRVc2VyRmllbGRWYWx1ZSA9IG9iamVjdFtwb2ludGVyUGVybS5rZXldO1xuICAgICAgICBpZiAocmVhZFVzZXJGaWVsZFZhbHVlKSB7XG4gICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVhZFVzZXJGaWVsZFZhbHVlKSkge1xuICAgICAgICAgICAgcG9pbnRlclBlcm1JbmNsdWRlc1VzZXIgPSByZWFkVXNlckZpZWxkVmFsdWUuc29tZShcbiAgICAgICAgICAgICAgdXNlciA9PiB1c2VyLm9iamVjdElkICYmIHVzZXIub2JqZWN0SWQgPT09IHVzZXJJZFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9pbnRlclBlcm1JbmNsdWRlc1VzZXIgPVxuICAgICAgICAgICAgICByZWFkVXNlckZpZWxkVmFsdWUub2JqZWN0SWQgJiYgcmVhZFVzZXJGaWVsZFZhbHVlLm9iamVjdElkID09PSB1c2VySWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvaW50ZXJQZXJtSW5jbHVkZXNVc2VyKSB7XG4gICAgICAgICAgb3ZlcnJpZGVQcm90ZWN0ZWRGaWVsZHMgPSB0cnVlO1xuICAgICAgICAgIG5ld1Byb3RlY3RlZEZpZWxkcy5wdXNoKHBvaW50ZXJQZXJtLnZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIGlmIGF0IGxlYXN0IG9uZSBwb2ludGVyLXBlcm1pc3Npb24gYWZmZWN0ZWQgdGhlIGN1cnJlbnQgdXNlclxuICAgICAgLy8gaW50ZXJzZWN0IHZzIHByb3RlY3RlZEZpZWxkcyBmcm9tIHByZXZpb3VzIHN0YWdlIChAc2VlIGFkZFByb3RlY3RlZEZpZWxkcylcbiAgICAgIC8vIFNldHMgdGhlb3J5IChpbnRlcnNlY3Rpb25zKTogQSB4IChCIHggQykgPT0gKEEgeCBCKSB4IENcbiAgICAgIGlmIChvdmVycmlkZVByb3RlY3RlZEZpZWxkcyAmJiBwcm90ZWN0ZWRGaWVsZHMpIHtcbiAgICAgICAgbmV3UHJvdGVjdGVkRmllbGRzLnB1c2gocHJvdGVjdGVkRmllbGRzKTtcbiAgICAgIH1cbiAgICAgIC8vIGludGVyc2VjdCBhbGwgc2V0cyBvZiBwcm90ZWN0ZWRGaWVsZHNcbiAgICAgIG5ld1Byb3RlY3RlZEZpZWxkcy5mb3JFYWNoKGZpZWxkcyA9PiB7XG4gICAgICAgIGlmIChmaWVsZHMpIHtcbiAgICAgICAgICAvLyBpZiB0aGVyZSdyZSBubyBwcm90Y3RlZEZpZWxkcyBieSBvdGhlciBjcml0ZXJpYSAoIGlkIC8gcm9sZSAvIGF1dGgpXG4gICAgICAgICAgLy8gdGhlbiB3ZSBtdXN0IGludGVyc2VjdCBlYWNoIHNldCAocGVyIHVzZXJGaWVsZClcbiAgICAgICAgICBpZiAoIXByb3RlY3RlZEZpZWxkcykge1xuICAgICAgICAgICAgcHJvdGVjdGVkRmllbGRzID0gZmllbGRzO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm90ZWN0ZWRGaWVsZHMgPSBwcm90ZWN0ZWRGaWVsZHMuZmlsdGVyKHYgPT4gZmllbGRzLmluY2x1ZGVzKHYpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGlzVXNlckNsYXNzID0gY2xhc3NOYW1lID09PSAnX1VzZXInO1xuICBpZiAoaXNVc2VyQ2xhc3MpIHtcbiAgICBvYmplY3QucGFzc3dvcmQgPSBvYmplY3QuX2hhc2hlZF9wYXNzd29yZDtcbiAgICBkZWxldGUgb2JqZWN0Ll9oYXNoZWRfcGFzc3dvcmQ7XG4gICAgZGVsZXRlIG9iamVjdC5zZXNzaW9uVG9rZW47XG4gIH1cblxuICBpZiAoaXNNYWludGVuYW5jZSkge1xuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICAvKiBzcGVjaWFsIHRyZWF0IGZvciB0aGUgdXNlciBjbGFzczogZG9uJ3QgZmlsdGVyIHByb3RlY3RlZEZpZWxkcyBpZiBjdXJyZW50bHkgbG9nZ2VkaW4gdXNlciBpc1xuICB0aGUgcmV0cmlldmVkIHVzZXIgKi9cbiAgaWYgKCEoaXNVc2VyQ2xhc3MgJiYgdXNlcklkICYmIG9iamVjdC5vYmplY3RJZCA9PT0gdXNlcklkKSkge1xuICAgIHByb3RlY3RlZEZpZWxkcyAmJiBwcm90ZWN0ZWRGaWVsZHMuZm9yRWFjaChrID0+IGRlbGV0ZSBvYmplY3Rba10pO1xuXG4gICAgLy8gZmllbGRzIG5vdCByZXF1ZXN0ZWQgYnkgY2xpZW50IChleGNsdWRlZCksXG4gICAgLy8gYnV0IHdlcmUgbmVlZGVkIHRvIGFwcGx5IHByb3RlY3RlZEZpZWxkc1xuICAgIHBlcm1zPy5wcm90ZWN0ZWRGaWVsZHM/LnRlbXBvcmFyeUtleXM/LmZvckVhY2goayA9PiBkZWxldGUgb2JqZWN0W2tdKTtcbiAgfVxuXG4gIGZvciAoY29uc3Qga2V5IGluIG9iamVjdCkge1xuICAgIGlmIChrZXkuY2hhckF0KDApID09PSAnXycpIHtcbiAgICAgIGRlbGV0ZSBvYmplY3Rba2V5XTtcbiAgICB9XG4gIH1cblxuICBpZiAoIWlzVXNlckNsYXNzIHx8IGlzTWFzdGVyKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIGlmIChhY2xHcm91cC5pbmRleE9mKG9iamVjdC5vYmplY3RJZCkgPiAtMSkge1xuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cbiAgZGVsZXRlIG9iamVjdC5hdXRoRGF0YTtcbiAgcmV0dXJuIG9iamVjdDtcbn07XG5cbi8vIFJ1bnMgYW4gdXBkYXRlIG9uIHRoZSBkYXRhYmFzZS5cbi8vIFJldHVybnMgYSBwcm9taXNlIGZvciBhbiBvYmplY3Qgd2l0aCB0aGUgbmV3IHZhbHVlcyBmb3IgZmllbGRcbi8vIG1vZGlmaWNhdGlvbnMgdGhhdCBkb24ndCBrbm93IHRoZWlyIHJlc3VsdHMgYWhlYWQgb2YgdGltZSwgbGlrZVxuLy8gJ2luY3JlbWVudCcuXG4vLyBPcHRpb25zOlxuLy8gICBhY2w6ICBhIGxpc3Qgb2Ygc3RyaW5ncy4gSWYgdGhlIG9iamVjdCB0byBiZSB1cGRhdGVkIGhhcyBhbiBBQ0wsXG4vLyAgICAgICAgIG9uZSBvZiB0aGUgcHJvdmlkZWQgc3RyaW5ncyBtdXN0IHByb3ZpZGUgdGhlIGNhbGxlciB3aXRoXG4vLyAgICAgICAgIHdyaXRlIHBlcm1pc3Npb25zLlxuY29uc3Qgc3BlY2lhbEtleXNGb3JVcGRhdGUgPSBbXG4gICdfaGFzaGVkX3Bhc3N3b3JkJyxcbiAgJ19wZXJpc2hhYmxlX3Rva2VuJyxcbiAgJ19lbWFpbF92ZXJpZnlfdG9rZW4nLFxuICAnX2VtYWlsX3ZlcmlmeV90b2tlbl9leHBpcmVzX2F0JyxcbiAgJ19hY2NvdW50X2xvY2tvdXRfZXhwaXJlc19hdCcsXG4gICdfZmFpbGVkX2xvZ2luX2NvdW50JyxcbiAgJ19wZXJpc2hhYmxlX3Rva2VuX2V4cGlyZXNfYXQnLFxuICAnX3Bhc3N3b3JkX2NoYW5nZWRfYXQnLFxuICAnX3Bhc3N3b3JkX2hpc3RvcnknLFxuXTtcblxuY29uc3QgaXNTcGVjaWFsVXBkYXRlS2V5ID0ga2V5ID0+IHtcbiAgcmV0dXJuIHNwZWNpYWxLZXlzRm9yVXBkYXRlLmluZGV4T2Yoa2V5KSA+PSAwO1xufTtcblxuZnVuY3Rpb24gam9pblRhYmxlTmFtZShjbGFzc05hbWUsIGtleSkge1xuICByZXR1cm4gYF9Kb2luOiR7a2V5fToke2NsYXNzTmFtZX1gO1xufVxuXG5jb25zdCBmbGF0dGVuVXBkYXRlT3BlcmF0b3JzRm9yQ3JlYXRlID0gb2JqZWN0ID0+IHtcbiAgZm9yIChjb25zdCBrZXkgaW4gb2JqZWN0KSB7XG4gICAgaWYgKG9iamVjdFtrZXldICYmIG9iamVjdFtrZXldLl9fb3ApIHtcbiAgICAgIHN3aXRjaCAob2JqZWN0W2tleV0uX19vcCkge1xuICAgICAgICBjYXNlICdJbmNyZW1lbnQnOlxuICAgICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0W2tleV0uYW1vdW50ICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgJ29iamVjdHMgdG8gYWRkIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgb2JqZWN0W2tleV0gPSBvYmplY3Rba2V5XS5hbW91bnQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0FkZCc6XG4gICAgICAgICAgaWYgKCEob2JqZWN0W2tleV0ub2JqZWN0cyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfSlNPTiwgJ29iamVjdHMgdG8gYWRkIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgb2JqZWN0W2tleV0gPSBvYmplY3Rba2V5XS5vYmplY3RzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdBZGRVbmlxdWUnOlxuICAgICAgICAgIGlmICghKG9iamVjdFtrZXldLm9iamVjdHMgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0pTT04sICdvYmplY3RzIHRvIGFkZCBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9iamVjdFtrZXldID0gb2JqZWN0W2tleV0ub2JqZWN0cztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnUmVtb3ZlJzpcbiAgICAgICAgICBpZiAoIShvYmplY3Rba2V5XS5vYmplY3RzIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCAnb2JqZWN0cyB0byBhZGQgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBvYmplY3Rba2V5XSA9IFtdO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEZWxldGUnOlxuICAgICAgICAgIGRlbGV0ZSBvYmplY3Rba2V5XTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICBQYXJzZS5FcnJvci5DT01NQU5EX1VOQVZBSUxBQkxFLFxuICAgICAgICAgICAgYFRoZSAke29iamVjdFtrZXldLl9fb3B9IG9wZXJhdG9yIGlzIG5vdCBzdXBwb3J0ZWQgeWV0LmBcbiAgICAgICAgICApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuY29uc3QgdHJhbnNmb3JtQXV0aERhdGEgPSAoY2xhc3NOYW1lLCBvYmplY3QsIHNjaGVtYSkgPT4ge1xuICBpZiAob2JqZWN0LmF1dGhEYXRhICYmIGNsYXNzTmFtZSA9PT0gJ19Vc2VyJykge1xuICAgIE9iamVjdC5rZXlzKG9iamVjdC5hdXRoRGF0YSkuZm9yRWFjaChwcm92aWRlciA9PiB7XG4gICAgICBjb25zdCBwcm92aWRlckRhdGEgPSBvYmplY3QuYXV0aERhdGFbcHJvdmlkZXJdO1xuICAgICAgY29uc3QgZmllbGROYW1lID0gYF9hdXRoX2RhdGFfJHtwcm92aWRlcn1gO1xuICAgICAgaWYgKHByb3ZpZGVyRGF0YSA9PSBudWxsKSB7XG4gICAgICAgIG9iamVjdFtmaWVsZE5hbWVdID0ge1xuICAgICAgICAgIF9fb3A6ICdEZWxldGUnLFxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0W2ZpZWxkTmFtZV0gPSBwcm92aWRlckRhdGE7XG4gICAgICAgIHNjaGVtYS5maWVsZHNbZmllbGROYW1lXSA9IHsgdHlwZTogJ09iamVjdCcgfTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBkZWxldGUgb2JqZWN0LmF1dGhEYXRhO1xuICB9XG59O1xuLy8gVHJhbnNmb3JtcyBhIERhdGFiYXNlIGZvcm1hdCBBQ0wgdG8gYSBSRVNUIEFQSSBmb3JtYXQgQUNMXG5jb25zdCB1bnRyYW5zZm9ybU9iamVjdEFDTCA9ICh7IF9ycGVybSwgX3dwZXJtLCAuLi5vdXRwdXQgfSkgPT4ge1xuICBpZiAoX3JwZXJtIHx8IF93cGVybSkge1xuICAgIG91dHB1dC5BQ0wgPSB7fTtcblxuICAgIChfcnBlcm0gfHwgW10pLmZvckVhY2goZW50cnkgPT4ge1xuICAgICAgaWYgKCFvdXRwdXQuQUNMW2VudHJ5XSkge1xuICAgICAgICBvdXRwdXQuQUNMW2VudHJ5XSA9IHsgcmVhZDogdHJ1ZSB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb3V0cHV0LkFDTFtlbnRyeV1bJ3JlYWQnXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAoX3dwZXJtIHx8IFtdKS5mb3JFYWNoKGVudHJ5ID0+IHtcbiAgICAgIGlmICghb3V0cHV0LkFDTFtlbnRyeV0pIHtcbiAgICAgICAgb3V0cHV0LkFDTFtlbnRyeV0gPSB7IHdyaXRlOiB0cnVlIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvdXRwdXQuQUNMW2VudHJ5XVsnd3JpdGUnXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIG91dHB1dDtcbn07XG5cbi8qKlxuICogV2hlbiBxdWVyeWluZywgdGhlIGZpZWxkTmFtZSBtYXkgYmUgY29tcG91bmQsIGV4dHJhY3QgdGhlIHJvb3QgZmllbGROYW1lXG4gKiAgICAgYHRlbXBlcmF0dXJlLmNlbHNpdXNgIGJlY29tZXMgYHRlbXBlcmF0dXJlYFxuICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkTmFtZSB0aGF0IG1heSBiZSBhIGNvbXBvdW5kIGZpZWxkIG5hbWVcbiAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSByb290IG5hbWUgb2YgdGhlIGZpZWxkXG4gKi9cbmNvbnN0IGdldFJvb3RGaWVsZE5hbWUgPSAoZmllbGROYW1lOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICByZXR1cm4gZmllbGROYW1lLnNwbGl0KCcuJylbMF07XG59O1xuXG5jb25zdCByZWxhdGlvblNjaGVtYSA9IHtcbiAgZmllbGRzOiB7IHJlbGF0ZWRJZDogeyB0eXBlOiAnU3RyaW5nJyB9LCBvd25pbmdJZDogeyB0eXBlOiAnU3RyaW5nJyB9IH0sXG59O1xuXG5jbGFzcyBEYXRhYmFzZUNvbnRyb2xsZXIge1xuICBhZGFwdGVyOiBTdG9yYWdlQWRhcHRlcjtcbiAgc2NoZW1hQ2FjaGU6IGFueTtcbiAgc2NoZW1hUHJvbWlzZTogP1Byb21pc2U8U2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyPjtcbiAgX3RyYW5zYWN0aW9uYWxTZXNzaW9uOiA/YW55O1xuICBvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnM7XG4gIGlkZW1wb3RlbmN5T3B0aW9uczogYW55O1xuXG4gIGNvbnN0cnVjdG9yKGFkYXB0ZXI6IFN0b3JhZ2VBZGFwdGVyLCBvcHRpb25zOiBQYXJzZVNlcnZlck9wdGlvbnMpIHtcbiAgICB0aGlzLmFkYXB0ZXIgPSBhZGFwdGVyO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgdGhpcy5pZGVtcG90ZW5jeU9wdGlvbnMgPSB0aGlzLm9wdGlvbnMuaWRlbXBvdGVuY3lPcHRpb25zIHx8IHt9O1xuICAgIC8vIFByZXZlbnQgbXV0YWJsZSB0aGlzLnNjaGVtYSwgb3RoZXJ3aXNlIG9uZSByZXF1ZXN0IGNvdWxkIHVzZVxuICAgIC8vIG11bHRpcGxlIHNjaGVtYXMsIHNvIGluc3RlYWQgdXNlIGxvYWRTY2hlbWEgdG8gZ2V0IGEgc2NoZW1hLlxuICAgIHRoaXMuc2NoZW1hUHJvbWlzZSA9IG51bGw7XG4gICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb24gPSBudWxsO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gIH1cblxuICBjb2xsZWN0aW9uRXhpc3RzKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlci5jbGFzc0V4aXN0cyhjbGFzc05hbWUpO1xuICB9XG5cbiAgcHVyZ2VDb2xsZWN0aW9uKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzY2hlbWFDb250cm9sbGVyID0+IHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSkpXG4gICAgICAudGhlbihzY2hlbWEgPT4gdGhpcy5hZGFwdGVyLmRlbGV0ZU9iamVjdHNCeVF1ZXJ5KGNsYXNzTmFtZSwgc2NoZW1hLCB7fSkpO1xuICB9XG5cbiAgdmFsaWRhdGVDbGFzc05hbWUoY2xhc3NOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIVNjaGVtYUNvbnRyb2xsZXIuY2xhc3NOYW1lSXNWYWxpZChjbGFzc05hbWUpKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoXG4gICAgICAgIG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0NMQVNTX05BTUUsICdpbnZhbGlkIGNsYXNzTmFtZTogJyArIGNsYXNzTmFtZSlcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIGZvciBhIHNjaGVtYUNvbnRyb2xsZXIuXG4gIGxvYWRTY2hlbWEoXG4gICAgb3B0aW9uczogTG9hZFNjaGVtYU9wdGlvbnMgPSB7IGNsZWFyQ2FjaGU6IGZhbHNlIH1cbiAgKTogUHJvbWlzZTxTY2hlbWFDb250cm9sbGVyLlNjaGVtYUNvbnRyb2xsZXI+IHtcbiAgICBpZiAodGhpcy5zY2hlbWFQcm9taXNlICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjaGVtYVByb21pc2U7XG4gICAgfVxuICAgIHRoaXMuc2NoZW1hUHJvbWlzZSA9IFNjaGVtYUNvbnRyb2xsZXIubG9hZCh0aGlzLmFkYXB0ZXIsIG9wdGlvbnMpO1xuICAgIHRoaXMuc2NoZW1hUHJvbWlzZS50aGVuKFxuICAgICAgKCkgPT4gZGVsZXRlIHRoaXMuc2NoZW1hUHJvbWlzZSxcbiAgICAgICgpID0+IGRlbGV0ZSB0aGlzLnNjaGVtYVByb21pc2VcbiAgICApO1xuICAgIHJldHVybiB0aGlzLmxvYWRTY2hlbWEob3B0aW9ucyk7XG4gIH1cblxuICBsb2FkU2NoZW1hSWZOZWVkZWQoXG4gICAgc2NoZW1hQ29udHJvbGxlcjogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyLFxuICAgIG9wdGlvbnM6IExvYWRTY2hlbWFPcHRpb25zID0geyBjbGVhckNhY2hlOiBmYWxzZSB9XG4gICk6IFByb21pc2U8U2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyPiB7XG4gICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXIgPyBQcm9taXNlLnJlc29sdmUoc2NoZW1hQ29udHJvbGxlcikgOiB0aGlzLmxvYWRTY2hlbWEob3B0aW9ucyk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIGNsYXNzbmFtZSB0aGF0IGlzIHJlbGF0ZWQgdG8gdGhlIGdpdmVuXG4gIC8vIGNsYXNzbmFtZSB0aHJvdWdoIHRoZSBrZXkuXG4gIC8vIFRPRE86IG1ha2UgdGhpcyBub3QgaW4gdGhlIERhdGFiYXNlQ29udHJvbGxlciBpbnRlcmZhY2VcbiAgcmVkaXJlY3RDbGFzc05hbWVGb3JLZXkoY2xhc3NOYW1lOiBzdHJpbmcsIGtleTogc3RyaW5nKTogUHJvbWlzZTw/c3RyaW5nPiB7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgIHZhciB0ID0gc2NoZW1hLmdldEV4cGVjdGVkVHlwZShjbGFzc05hbWUsIGtleSk7XG4gICAgICBpZiAodCAhPSBudWxsICYmIHR5cGVvZiB0ICE9PSAnc3RyaW5nJyAmJiB0LnR5cGUgPT09ICdSZWxhdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIHQudGFyZ2V0Q2xhc3M7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2xhc3NOYW1lO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gVXNlcyB0aGUgc2NoZW1hIHRvIHZhbGlkYXRlIHRoZSBvYmplY3QgKFJFU1QgQVBJIGZvcm1hdCkuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIG5ldyBzY2hlbWEuXG4gIC8vIFRoaXMgZG9lcyBub3QgdXBkYXRlIHRoaXMuc2NoZW1hLCBiZWNhdXNlIGluIGEgc2l0dWF0aW9uIGxpa2UgYVxuICAvLyBiYXRjaCByZXF1ZXN0LCB0aGF0IGNvdWxkIGNvbmZ1c2Ugb3RoZXIgdXNlcnMgb2YgdGhlIHNjaGVtYS5cbiAgdmFsaWRhdGVPYmplY3QoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0OiBhbnksXG4gICAgcXVlcnk6IGFueSxcbiAgICBydW5PcHRpb25zOiBRdWVyeU9wdGlvbnMsXG4gICAgbWFpbnRlbmFuY2U6IGJvb2xlYW5cbiAgKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgbGV0IHNjaGVtYTtcbiAgICBjb25zdCBhY2wgPSBydW5PcHRpb25zLmFjbDtcbiAgICBjb25zdCBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIHZhciBhY2xHcm91cDogc3RyaW5nW10gPSBhY2wgfHwgW107XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSgpXG4gICAgICAudGhlbihzID0+IHtcbiAgICAgICAgc2NoZW1hID0gcztcbiAgICAgICAgaWYgKGlzTWFzdGVyKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmNhbkFkZEZpZWxkKHNjaGVtYSwgY2xhc3NOYW1lLCBvYmplY3QsIGFjbEdyb3VwLCBydW5PcHRpb25zKTtcbiAgICAgIH0pXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJldHVybiBzY2hlbWEudmFsaWRhdGVPYmplY3QoY2xhc3NOYW1lLCBvYmplY3QsIHF1ZXJ5LCBtYWludGVuYW5jZSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHVwZGF0ZShcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBxdWVyeTogYW55LFxuICAgIHVwZGF0ZTogYW55LFxuICAgIHsgYWNsLCBtYW55LCB1cHNlcnQsIGFkZHNGaWVsZCB9OiBGdWxsUXVlcnlPcHRpb25zID0ge30sXG4gICAgc2tpcFNhbml0aXphdGlvbjogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHZhbGlkYXRlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHZhbGlkU2NoZW1hQ29udHJvbGxlcjogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyXG4gICk6IFByb21pc2U8YW55PiB7XG4gICAgdHJ5IHtcbiAgICAgIFV0aWxzLmNoZWNrUHJvaGliaXRlZEtleXdvcmRzKHRoaXMub3B0aW9ucywgdXBkYXRlKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLCBlcnJvcikpO1xuICAgIH1cbiAgICBjb25zdCBvcmlnaW5hbFF1ZXJ5ID0gcXVlcnk7XG4gICAgY29uc3Qgb3JpZ2luYWxVcGRhdGUgPSB1cGRhdGU7XG4gICAgLy8gTWFrZSBhIGNvcHkgb2YgdGhlIG9iamVjdCwgc28gd2UgZG9uJ3QgbXV0YXRlIHRoZSBpbmNvbWluZyBkYXRhLlxuICAgIHVwZGF0ZSA9IGRlZXBjb3B5KHVwZGF0ZSk7XG4gICAgdmFyIHJlbGF0aW9uVXBkYXRlcyA9IFtdO1xuICAgIHZhciBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIHZhciBhY2xHcm91cCA9IGFjbCB8fCBbXTtcblxuICAgIHJldHVybiB0aGlzLmxvYWRTY2hlbWFJZk5lZWRlZCh2YWxpZFNjaGVtYUNvbnRyb2xsZXIpLnRoZW4oc2NoZW1hQ29udHJvbGxlciA9PiB7XG4gICAgICByZXR1cm4gKGlzTWFzdGVyXG4gICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgOiBzY2hlbWFDb250cm9sbGVyLnZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWUsIGFjbEdyb3VwLCAndXBkYXRlJylcbiAgICAgIClcbiAgICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIHJlbGF0aW9uVXBkYXRlcyA9IHRoaXMuY29sbGVjdFJlbGF0aW9uVXBkYXRlcyhjbGFzc05hbWUsIG9yaWdpbmFsUXVlcnkub2JqZWN0SWQsIHVwZGF0ZSk7XG4gICAgICAgICAgaWYgKCFpc01hc3Rlcikge1xuICAgICAgICAgICAgcXVlcnkgPSB0aGlzLmFkZFBvaW50ZXJQZXJtaXNzaW9ucyhcbiAgICAgICAgICAgICAgc2NoZW1hQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAndXBkYXRlJyxcbiAgICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoYWRkc0ZpZWxkKSB7XG4gICAgICAgICAgICAgIHF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgICRhbmQ6IFtcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICAgICAgdGhpcy5hZGRQb2ludGVyUGVybWlzc2lvbnMoXG4gICAgICAgICAgICAgICAgICAgIHNjaGVtYUNvbnRyb2xsZXIsXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgJ2FkZEZpZWxkJyxcbiAgICAgICAgICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghcXVlcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGFjbCkge1xuICAgICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFsaWRhdGVRdWVyeShxdWVyeSwgaXNNYXN0ZXIsIGZhbHNlLCB0cnVlKTtcbiAgICAgICAgICByZXR1cm4gc2NoZW1hQ29udHJvbGxlclxuICAgICAgICAgICAgLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIHRydWUpXG4gICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAvLyBJZiB0aGUgc2NoZW1hIGRvZXNuJ3QgZXhpc3QsIHByZXRlbmQgaXQgZXhpc3RzIHdpdGggbm8gZmllbGRzLiBUaGlzIGJlaGF2aW9yXG4gICAgICAgICAgICAgIC8vIHdpbGwgbGlrZWx5IG5lZWQgcmV2aXNpdGluZy5cbiAgICAgICAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnRoZW4oc2NoZW1hID0+IHtcbiAgICAgICAgICAgICAgT2JqZWN0LmtleXModXBkYXRlKS5mb3JFYWNoKGZpZWxkTmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGZpZWxkTmFtZS5tYXRjaCgvXmF1dGhEYXRhXFwuKFthLXpBLVowLTlfXSspXFwuaWQkLykpIHtcbiAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSxcbiAgICAgICAgICAgICAgICAgICAgYEludmFsaWQgZmllbGQgbmFtZSBmb3IgdXBkYXRlOiAke2ZpZWxkTmFtZX1gXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCByb290RmllbGROYW1lID0gZ2V0Um9vdEZpZWxkTmFtZShmaWVsZE5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICFTY2hlbWFDb250cm9sbGVyLmZpZWxkTmFtZUlzVmFsaWQocm9vdEZpZWxkTmFtZSwgY2xhc3NOYW1lKSAmJlxuICAgICAgICAgICAgICAgICAgIWlzU3BlY2lhbFVwZGF0ZUtleShyb290RmllbGROYW1lKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLFxuICAgICAgICAgICAgICAgICAgICBgSW52YWxpZCBmaWVsZCBuYW1lIGZvciB1cGRhdGU6ICR7ZmllbGROYW1lfWBcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgZm9yIChjb25zdCB1cGRhdGVPcGVyYXRpb24gaW4gdXBkYXRlKSB7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgdXBkYXRlW3VwZGF0ZU9wZXJhdGlvbl0gJiZcbiAgICAgICAgICAgICAgICAgIHR5cGVvZiB1cGRhdGVbdXBkYXRlT3BlcmF0aW9uXSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHVwZGF0ZVt1cGRhdGVPcGVyYXRpb25dKS5zb21lKFxuICAgICAgICAgICAgICAgICAgICBpbm5lcktleSA9PiBpbm5lcktleS5pbmNsdWRlcygnJCcpIHx8IGlubmVyS2V5LmluY2x1ZGVzKCcuJylcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9ORVNURURfS0VZLFxuICAgICAgICAgICAgICAgICAgICBcIk5lc3RlZCBrZXlzIHNob3VsZCBub3QgY29udGFpbiB0aGUgJyQnIG9yICcuJyBjaGFyYWN0ZXJzXCJcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHVwZGF0ZSA9IHRyYW5zZm9ybU9iamVjdEFDTCh1cGRhdGUpO1xuICAgICAgICAgICAgICB0cmFuc2Zvcm1BdXRoRGF0YShjbGFzc05hbWUsIHVwZGF0ZSwgc2NoZW1hKTtcbiAgICAgICAgICAgICAgaWYgKHZhbGlkYXRlT25seSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZmluZChjbGFzc05hbWUsIHNjaGVtYSwgcXVlcnksIHt9KS50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCwgJ09iamVjdCBub3QgZm91bmQuJyk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKG1hbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLnVwZGF0ZU9iamVjdHNCeVF1ZXJ5KFxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgICAgICAgcXVlcnksXG4gICAgICAgICAgICAgICAgICB1cGRhdGUsXG4gICAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvblxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAodXBzZXJ0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci51cHNlcnRPbmVPYmplY3QoXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmZpbmRPbmVBbmRVcGRhdGUoXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgIHVwZGF0ZSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCwgJ09iamVjdCBub3QgZm91bmQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh2YWxpZGF0ZU9ubHkpIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0aGlzLmhhbmRsZVJlbGF0aW9uVXBkYXRlcyhcbiAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgIG9yaWdpbmFsUXVlcnkub2JqZWN0SWQsXG4gICAgICAgICAgICB1cGRhdGUsXG4gICAgICAgICAgICByZWxhdGlvblVwZGF0ZXNcbiAgICAgICAgICApLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgICBpZiAoc2tpcFNhbml0aXphdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdGhpcy5fc2FuaXRpemVEYXRhYmFzZVJlc3VsdChvcmlnaW5hbFVwZGF0ZSwgcmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBDb2xsZWN0IGFsbCByZWxhdGlvbi11cGRhdGluZyBvcGVyYXRpb25zIGZyb20gYSBSRVNULWZvcm1hdCB1cGRhdGUuXG4gIC8vIFJldHVybnMgYSBsaXN0IG9mIGFsbCByZWxhdGlvbiB1cGRhdGVzIHRvIHBlcmZvcm1cbiAgLy8gVGhpcyBtdXRhdGVzIHVwZGF0ZS5cbiAgY29sbGVjdFJlbGF0aW9uVXBkYXRlcyhjbGFzc05hbWU6IHN0cmluZywgb2JqZWN0SWQ6ID9zdHJpbmcsIHVwZGF0ZTogYW55KSB7XG4gICAgdmFyIG9wcyA9IFtdO1xuICAgIHZhciBkZWxldGVNZSA9IFtdO1xuICAgIG9iamVjdElkID0gdXBkYXRlLm9iamVjdElkIHx8IG9iamVjdElkO1xuXG4gICAgdmFyIHByb2Nlc3MgPSAob3AsIGtleSkgPT4ge1xuICAgICAgaWYgKCFvcCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAob3AuX19vcCA9PSAnQWRkUmVsYXRpb24nKSB7XG4gICAgICAgIG9wcy5wdXNoKHsga2V5LCBvcCB9KTtcbiAgICAgICAgZGVsZXRlTWUucHVzaChrZXkpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3AuX19vcCA9PSAnUmVtb3ZlUmVsYXRpb24nKSB7XG4gICAgICAgIG9wcy5wdXNoKHsga2V5LCBvcCB9KTtcbiAgICAgICAgZGVsZXRlTWUucHVzaChrZXkpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3AuX19vcCA9PSAnQmF0Y2gnKSB7XG4gICAgICAgIGZvciAodmFyIHggb2Ygb3Aub3BzKSB7XG4gICAgICAgICAgcHJvY2Vzcyh4LCBrZXkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfTtcblxuICAgIGZvciAoY29uc3Qga2V5IGluIHVwZGF0ZSkge1xuICAgICAgcHJvY2Vzcyh1cGRhdGVba2V5XSwga2V5KTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBrZXkgb2YgZGVsZXRlTWUpIHtcbiAgICAgIGRlbGV0ZSB1cGRhdGVba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIG9wcztcbiAgfVxuXG4gIC8vIFByb2Nlc3NlcyByZWxhdGlvbi11cGRhdGluZyBvcGVyYXRpb25zIGZyb20gYSBSRVNULWZvcm1hdCB1cGRhdGUuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiBhbGwgdXBkYXRlcyBoYXZlIGJlZW4gcGVyZm9ybWVkXG4gIGhhbmRsZVJlbGF0aW9uVXBkYXRlcyhjbGFzc05hbWU6IHN0cmluZywgb2JqZWN0SWQ6IHN0cmluZywgdXBkYXRlOiBhbnksIG9wczogYW55KSB7XG4gICAgdmFyIHBlbmRpbmcgPSBbXTtcbiAgICBvYmplY3RJZCA9IHVwZGF0ZS5vYmplY3RJZCB8fCBvYmplY3RJZDtcbiAgICBvcHMuZm9yRWFjaCgoeyBrZXksIG9wIH0pID0+IHtcbiAgICAgIGlmICghb3ApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKG9wLl9fb3AgPT0gJ0FkZFJlbGF0aW9uJykge1xuICAgICAgICBmb3IgKGNvbnN0IG9iamVjdCBvZiBvcC5vYmplY3RzKSB7XG4gICAgICAgICAgcGVuZGluZy5wdXNoKHRoaXMuYWRkUmVsYXRpb24oa2V5LCBjbGFzc05hbWUsIG9iamVjdElkLCBvYmplY3Qub2JqZWN0SWQpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAob3AuX19vcCA9PSAnUmVtb3ZlUmVsYXRpb24nKSB7XG4gICAgICAgIGZvciAoY29uc3Qgb2JqZWN0IG9mIG9wLm9iamVjdHMpIHtcbiAgICAgICAgICBwZW5kaW5nLnB1c2godGhpcy5yZW1vdmVSZWxhdGlvbihrZXksIGNsYXNzTmFtZSwgb2JqZWN0SWQsIG9iamVjdC5vYmplY3RJZCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwocGVuZGluZyk7XG4gIH1cblxuICAvLyBBZGRzIGEgcmVsYXRpb24uXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgc3VjY2Vzc2Z1bGx5IGlmZiB0aGUgYWRkIHdhcyBzdWNjZXNzZnVsLlxuICBhZGRSZWxhdGlvbihrZXk6IHN0cmluZywgZnJvbUNsYXNzTmFtZTogc3RyaW5nLCBmcm9tSWQ6IHN0cmluZywgdG9JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgZG9jID0ge1xuICAgICAgcmVsYXRlZElkOiB0b0lkLFxuICAgICAgb3duaW5nSWQ6IGZyb21JZCxcbiAgICB9O1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIudXBzZXJ0T25lT2JqZWN0KFxuICAgICAgYF9Kb2luOiR7a2V5fToke2Zyb21DbGFzc05hbWV9YCxcbiAgICAgIHJlbGF0aW9uU2NoZW1hLFxuICAgICAgZG9jLFxuICAgICAgZG9jLFxuICAgICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb25cbiAgICApO1xuICB9XG5cbiAgLy8gUmVtb3ZlcyBhIHJlbGF0aW9uLlxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHN1Y2Nlc3NmdWxseSBpZmYgdGhlIHJlbW92ZSB3YXNcbiAgLy8gc3VjY2Vzc2Z1bC5cbiAgcmVtb3ZlUmVsYXRpb24oa2V5OiBzdHJpbmcsIGZyb21DbGFzc05hbWU6IHN0cmluZywgZnJvbUlkOiBzdHJpbmcsIHRvSWQ6IHN0cmluZykge1xuICAgIHZhciBkb2MgPSB7XG4gICAgICByZWxhdGVkSWQ6IHRvSWQsXG4gICAgICBvd25pbmdJZDogZnJvbUlkLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlclxuICAgICAgLmRlbGV0ZU9iamVjdHNCeVF1ZXJ5KFxuICAgICAgICBgX0pvaW46JHtrZXl9OiR7ZnJvbUNsYXNzTmFtZX1gLFxuICAgICAgICByZWxhdGlvblNjaGVtYSxcbiAgICAgICAgZG9jLFxuICAgICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvblxuICAgICAgKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgLy8gV2UgZG9uJ3QgY2FyZSBpZiB0aGV5IHRyeSB0byBkZWxldGUgYSBub24tZXhpc3RlbnQgcmVsYXRpb24uXG4gICAgICAgIGlmIChlcnJvci5jb2RlID09IFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIFJlbW92ZXMgb2JqZWN0cyBtYXRjaGVzIHRoaXMgcXVlcnkgZnJvbSB0aGUgZGF0YWJhc2UuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgc3VjY2Vzc2Z1bGx5IGlmZiB0aGUgb2JqZWN0IHdhc1xuICAvLyBkZWxldGVkLlxuICAvLyBPcHRpb25zOlxuICAvLyAgIGFjbDogIGEgbGlzdCBvZiBzdHJpbmdzLiBJZiB0aGUgb2JqZWN0IHRvIGJlIHVwZGF0ZWQgaGFzIGFuIEFDTCxcbiAgLy8gICAgICAgICBvbmUgb2YgdGhlIHByb3ZpZGVkIHN0cmluZ3MgbXVzdCBwcm92aWRlIHRoZSBjYWxsZXIgd2l0aFxuICAvLyAgICAgICAgIHdyaXRlIHBlcm1pc3Npb25zLlxuICBkZXN0cm95KFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHF1ZXJ5OiBhbnksXG4gICAgeyBhY2wgfTogUXVlcnlPcHRpb25zID0ge30sXG4gICAgdmFsaWRTY2hlbWFDb250cm9sbGVyOiBTY2hlbWFDb250cm9sbGVyLlNjaGVtYUNvbnRyb2xsZXJcbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBpc01hc3RlciA9IGFjbCA9PT0gdW5kZWZpbmVkO1xuICAgIGNvbnN0IGFjbEdyb3VwID0gYWNsIHx8IFtdO1xuXG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYUlmTmVlZGVkKHZhbGlkU2NoZW1hQ29udHJvbGxlcikudGhlbihzY2hlbWFDb250cm9sbGVyID0+IHtcbiAgICAgIHJldHVybiAoaXNNYXN0ZXJcbiAgICAgICAgPyBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgICA6IHNjaGVtYUNvbnRyb2xsZXIudmFsaWRhdGVQZXJtaXNzaW9uKGNsYXNzTmFtZSwgYWNsR3JvdXAsICdkZWxldGUnKVxuICAgICAgKS50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKCFpc01hc3Rlcikge1xuICAgICAgICAgIHF1ZXJ5ID0gdGhpcy5hZGRQb2ludGVyUGVybWlzc2lvbnMoXG4gICAgICAgICAgICBzY2hlbWFDb250cm9sbGVyLFxuICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgJ2RlbGV0ZScsXG4gICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuT0JKRUNUX05PVF9GT1VORCwgJ09iamVjdCBub3QgZm91bmQuJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIGRlbGV0ZSBieSBxdWVyeVxuICAgICAgICBpZiAoYWNsKSB7XG4gICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsKTtcbiAgICAgICAgfVxuICAgICAgICB2YWxpZGF0ZVF1ZXJ5KHF1ZXJ5LCBpc01hc3RlciwgZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXJcbiAgICAgICAgICAuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSlcbiAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgLy8gSWYgdGhlIHNjaGVtYSBkb2Vzbid0IGV4aXN0LCBwcmV0ZW5kIGl0IGV4aXN0cyB3aXRoIG5vIGZpZWxkcy4gVGhpcyBiZWhhdmlvclxuICAgICAgICAgICAgLy8gd2lsbCBsaWtlbHkgbmVlZCByZXZpc2l0aW5nLlxuICAgICAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHsgZmllbGRzOiB7fSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAudGhlbihwYXJzZUZvcm1hdFNjaGVtYSA9PlxuICAgICAgICAgICAgdGhpcy5hZGFwdGVyLmRlbGV0ZU9iamVjdHNCeVF1ZXJ5KFxuICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgIHBhcnNlRm9ybWF0U2NoZW1hLFxuICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb25cbiAgICAgICAgICAgIClcbiAgICAgICAgICApXG4gICAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICAgIC8vIFdoZW4gZGVsZXRpbmcgc2Vzc2lvbnMgd2hpbGUgY2hhbmdpbmcgcGFzc3dvcmRzLCBkb24ndCB0aHJvdyBhbiBlcnJvciBpZiB0aGV5IGRvbid0IGhhdmUgYW55IHNlc3Npb25zLlxuICAgICAgICAgICAgaWYgKGNsYXNzTmFtZSA9PT0gJ19TZXNzaW9uJyAmJiBlcnJvci5jb2RlID09PSBQYXJzZS5FcnJvci5PQkpFQ1RfTk9UX0ZPVU5EKSB7XG4gICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIEluc2VydHMgYW4gb2JqZWN0IGludG8gdGhlIGRhdGFiYXNlLlxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHN1Y2Nlc3NmdWxseSBpZmYgdGhlIG9iamVjdCBzYXZlZC5cbiAgY3JlYXRlKFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIG9iamVjdDogYW55LFxuICAgIHsgYWNsIH06IFF1ZXJ5T3B0aW9ucyA9IHt9LFxuICAgIHZhbGlkYXRlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICAgIHZhbGlkU2NoZW1hQ29udHJvbGxlcjogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyXG4gICk6IFByb21pc2U8YW55PiB7XG4gICAgdHJ5IHtcbiAgICAgIFV0aWxzLmNoZWNrUHJvaGliaXRlZEtleXdvcmRzKHRoaXMub3B0aW9ucywgb2JqZWN0KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLCBlcnJvcikpO1xuICAgIH1cbiAgICAvLyBNYWtlIGEgY29weSBvZiB0aGUgb2JqZWN0LCBzbyB3ZSBkb24ndCBtdXRhdGUgdGhlIGluY29taW5nIGRhdGEuXG4gICAgY29uc3Qgb3JpZ2luYWxPYmplY3QgPSBvYmplY3Q7XG4gICAgb2JqZWN0ID0gdHJhbnNmb3JtT2JqZWN0QUNMKG9iamVjdCk7XG5cbiAgICBvYmplY3QuY3JlYXRlZEF0ID0geyBpc286IG9iamVjdC5jcmVhdGVkQXQsIF9fdHlwZTogJ0RhdGUnIH07XG4gICAgb2JqZWN0LnVwZGF0ZWRBdCA9IHsgaXNvOiBvYmplY3QudXBkYXRlZEF0LCBfX3R5cGU6ICdEYXRlJyB9O1xuXG4gICAgdmFyIGlzTWFzdGVyID0gYWNsID09PSB1bmRlZmluZWQ7XG4gICAgdmFyIGFjbEdyb3VwID0gYWNsIHx8IFtdO1xuICAgIGNvbnN0IHJlbGF0aW9uVXBkYXRlcyA9IHRoaXMuY29sbGVjdFJlbGF0aW9uVXBkYXRlcyhjbGFzc05hbWUsIG51bGwsIG9iamVjdCk7XG5cbiAgICByZXR1cm4gdGhpcy52YWxpZGF0ZUNsYXNzTmFtZShjbGFzc05hbWUpXG4gICAgICAudGhlbigoKSA9PiB0aGlzLmxvYWRTY2hlbWFJZk5lZWRlZCh2YWxpZFNjaGVtYUNvbnRyb2xsZXIpKVxuICAgICAgLnRoZW4oc2NoZW1hQ29udHJvbGxlciA9PiB7XG4gICAgICAgIHJldHVybiAoaXNNYXN0ZXJcbiAgICAgICAgICA/IFByb21pc2UucmVzb2x2ZSgpXG4gICAgICAgICAgOiBzY2hlbWFDb250cm9sbGVyLnZhbGlkYXRlUGVybWlzc2lvbihjbGFzc05hbWUsIGFjbEdyb3VwLCAnY3JlYXRlJylcbiAgICAgICAgKVxuICAgICAgICAgIC50aGVuKCgpID0+IHNjaGVtYUNvbnRyb2xsZXIuZW5mb3JjZUNsYXNzRXhpc3RzKGNsYXNzTmFtZSkpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gc2NoZW1hQ29udHJvbGxlci5nZXRPbmVTY2hlbWEoY2xhc3NOYW1lLCB0cnVlKSlcbiAgICAgICAgICAudGhlbihzY2hlbWEgPT4ge1xuICAgICAgICAgICAgdHJhbnNmb3JtQXV0aERhdGEoY2xhc3NOYW1lLCBvYmplY3QsIHNjaGVtYSk7XG4gICAgICAgICAgICBmbGF0dGVuVXBkYXRlT3BlcmF0b3JzRm9yQ3JlYXRlKG9iamVjdCk7XG4gICAgICAgICAgICBpZiAodmFsaWRhdGVPbmx5KSB7XG4gICAgICAgICAgICAgIHJldHVybiB7fTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuY3JlYXRlT2JqZWN0KFxuICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgIFNjaGVtYUNvbnRyb2xsZXIuY29udmVydFNjaGVtYVRvQWRhcHRlclNjaGVtYShzY2hlbWEpLFxuICAgICAgICAgICAgICBvYmplY3QsXG4gICAgICAgICAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgICAgIGlmICh2YWxpZGF0ZU9ubHkpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsT2JqZWN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGFuZGxlUmVsYXRpb25VcGRhdGVzKFxuICAgICAgICAgICAgICBjbGFzc05hbWUsXG4gICAgICAgICAgICAgIG9iamVjdC5vYmplY3RJZCxcbiAgICAgICAgICAgICAgb2JqZWN0LFxuICAgICAgICAgICAgICByZWxhdGlvblVwZGF0ZXNcbiAgICAgICAgICAgICkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zYW5pdGl6ZURhdGFiYXNlUmVzdWx0KG9yaWdpbmFsT2JqZWN0LCByZXN1bHQub3BzWzBdKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICBjYW5BZGRGaWVsZChcbiAgICBzY2hlbWE6IFNjaGVtYUNvbnRyb2xsZXIuU2NoZW1hQ29udHJvbGxlcixcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBvYmplY3Q6IGFueSxcbiAgICBhY2xHcm91cDogc3RyaW5nW10sXG4gICAgcnVuT3B0aW9uczogUXVlcnlPcHRpb25zXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNsYXNzU2NoZW1hID0gc2NoZW1hLnNjaGVtYURhdGFbY2xhc3NOYW1lXTtcbiAgICBpZiAoIWNsYXNzU2NoZW1hKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuICAgIGNvbnN0IGZpZWxkcyA9IE9iamVjdC5rZXlzKG9iamVjdCk7XG4gICAgY29uc3Qgc2NoZW1hRmllbGRzID0gT2JqZWN0LmtleXMoY2xhc3NTY2hlbWEuZmllbGRzKTtcbiAgICBjb25zdCBuZXdLZXlzID0gZmllbGRzLmZpbHRlcihmaWVsZCA9PiB7XG4gICAgICAvLyBTa2lwIGZpZWxkcyB0aGF0IGFyZSB1bnNldFxuICAgICAgaWYgKG9iamVjdFtmaWVsZF0gJiYgb2JqZWN0W2ZpZWxkXS5fX29wICYmIG9iamVjdFtmaWVsZF0uX19vcCA9PT0gJ0RlbGV0ZScpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHNjaGVtYUZpZWxkcy5pbmRleE9mKGdldFJvb3RGaWVsZE5hbWUoZmllbGQpKSA8IDA7XG4gICAgfSk7XG4gICAgaWYgKG5ld0tleXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYWRkcyBhIG1hcmtlciB0aGF0IG5ldyBmaWVsZCBpcyBiZWluZyBhZGRpbmcgZHVyaW5nIHVwZGF0ZVxuICAgICAgcnVuT3B0aW9ucy5hZGRzRmllbGQgPSB0cnVlO1xuXG4gICAgICBjb25zdCBhY3Rpb24gPSBydW5PcHRpb25zLmFjdGlvbjtcbiAgICAgIHJldHVybiBzY2hlbWEudmFsaWRhdGVQZXJtaXNzaW9uKGNsYXNzTmFtZSwgYWNsR3JvdXAsICdhZGRGaWVsZCcsIGFjdGlvbik7XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIC8vIFdvbid0IGRlbGV0ZSBjb2xsZWN0aW9ucyBpbiB0aGUgc3lzdGVtIG5hbWVzcGFjZVxuICAvKipcbiAgICogRGVsZXRlIGFsbCBjbGFzc2VzIGFuZCBjbGVhcnMgdGhlIHNjaGVtYSBjYWNoZVxuICAgKlxuICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZhc3Qgc2V0IHRvIHRydWUgaWYgaXQncyBvayB0byBqdXN0IGRlbGV0ZSByb3dzIGFuZCBub3QgaW5kZXhlc1xuICAgKiBAcmV0dXJucyB7UHJvbWlzZTx2b2lkPn0gd2hlbiB0aGUgZGVsZXRpb25zIGNvbXBsZXRlc1xuICAgKi9cbiAgZGVsZXRlRXZlcnl0aGluZyhmYXN0OiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPGFueT4ge1xuICAgIHRoaXMuc2NoZW1hUHJvbWlzZSA9IG51bGw7XG4gICAgU2NoZW1hQ2FjaGUuY2xlYXIoKTtcbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmRlbGV0ZUFsbENsYXNzZXMoZmFzdCk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgYSBsaXN0IG9mIHJlbGF0ZWQgaWRzIGdpdmVuIGFuIG93bmluZyBpZC5cbiAgLy8gY2xhc3NOYW1lIGhlcmUgaXMgdGhlIG93bmluZyBjbGFzc05hbWUuXG4gIHJlbGF0ZWRJZHMoXG4gICAgY2xhc3NOYW1lOiBzdHJpbmcsXG4gICAga2V5OiBzdHJpbmcsXG4gICAgb3duaW5nSWQ6IHN0cmluZyxcbiAgICBxdWVyeU9wdGlvbnM6IFF1ZXJ5T3B0aW9uc1xuICApOiBQcm9taXNlPEFycmF5PHN0cmluZz4+IHtcbiAgICBjb25zdCB7IHNraXAsIGxpbWl0LCBzb3J0IH0gPSBxdWVyeU9wdGlvbnM7XG4gICAgY29uc3QgZmluZE9wdGlvbnMgPSB7fTtcbiAgICBpZiAoc29ydCAmJiBzb3J0LmNyZWF0ZWRBdCAmJiB0aGlzLmFkYXB0ZXIuY2FuU29ydE9uSm9pblRhYmxlcykge1xuICAgICAgZmluZE9wdGlvbnMuc29ydCA9IHsgX2lkOiBzb3J0LmNyZWF0ZWRBdCB9O1xuICAgICAgZmluZE9wdGlvbnMubGltaXQgPSBsaW1pdDtcbiAgICAgIGZpbmRPcHRpb25zLnNraXAgPSBza2lwO1xuICAgICAgcXVlcnlPcHRpb25zLnNraXAgPSAwO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyXG4gICAgICAuZmluZChqb2luVGFibGVOYW1lKGNsYXNzTmFtZSwga2V5KSwgcmVsYXRpb25TY2hlbWEsIHsgb3duaW5nSWQgfSwgZmluZE9wdGlvbnMpXG4gICAgICAudGhlbihyZXN1bHRzID0+IHJlc3VsdHMubWFwKHJlc3VsdCA9PiByZXN1bHQucmVsYXRlZElkKSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSBmb3IgYSBsaXN0IG9mIG93bmluZyBpZHMgZ2l2ZW4gc29tZSByZWxhdGVkIGlkcy5cbiAgLy8gY2xhc3NOYW1lIGhlcmUgaXMgdGhlIG93bmluZyBjbGFzc05hbWUuXG4gIG93bmluZ0lkcyhjbGFzc05hbWU6IHN0cmluZywga2V5OiBzdHJpbmcsIHJlbGF0ZWRJZHM6IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXJcbiAgICAgIC5maW5kKFxuICAgICAgICBqb2luVGFibGVOYW1lKGNsYXNzTmFtZSwga2V5KSxcbiAgICAgICAgcmVsYXRpb25TY2hlbWEsXG4gICAgICAgIHsgcmVsYXRlZElkOiB7ICRpbjogcmVsYXRlZElkcyB9IH0sXG4gICAgICAgIHsga2V5czogWydvd25pbmdJZCddIH1cbiAgICAgIClcbiAgICAgIC50aGVuKHJlc3VsdHMgPT4gcmVzdWx0cy5tYXAocmVzdWx0ID0+IHJlc3VsdC5vd25pbmdJZCkpO1xuICB9XG5cbiAgLy8gTW9kaWZpZXMgcXVlcnkgc28gdGhhdCBpdCBubyBsb25nZXIgaGFzICRpbiBvbiByZWxhdGlvbiBmaWVsZHMsIG9yXG4gIC8vIGVxdWFsLXRvLXBvaW50ZXIgY29uc3RyYWludHMgb24gcmVsYXRpb24gZmllbGRzLlxuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gcXVlcnkgaXMgbXV0YXRlZFxuICByZWR1Y2VJblJlbGF0aW9uKGNsYXNzTmFtZTogc3RyaW5nLCBxdWVyeTogYW55LCBzY2hlbWE6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgLy8gU2VhcmNoIGZvciBhbiBpbi1yZWxhdGlvbiBvciBlcXVhbC10by1yZWxhdGlvblxuICAgIC8vIE1ha2UgaXQgc2VxdWVudGlhbCBmb3Igbm93LCBub3Qgc3VyZSBvZiBwYXJhbGxlaXphdGlvbiBzaWRlIGVmZmVjdHNcbiAgICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgIGlmIChxdWVyeVsnJG9yJ10pIHtcbiAgICAgIGNvbnN0IG9ycyA9IHF1ZXJ5Wyckb3InXTtcbiAgICAgIHByb21pc2VzLnB1c2goXG4gICAgICAgIC4uLm9ycy5tYXAoKGFRdWVyeSwgaW5kZXgpID0+IHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5yZWR1Y2VJblJlbGF0aW9uKGNsYXNzTmFtZSwgYVF1ZXJ5LCBzY2hlbWEpLnRoZW4oYVF1ZXJ5ID0+IHtcbiAgICAgICAgICAgIHF1ZXJ5Wyckb3InXVtpbmRleF0gPSBhUXVlcnk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cbiAgICBpZiAocXVlcnlbJyRhbmQnXSkge1xuICAgICAgY29uc3QgYW5kcyA9IHF1ZXJ5WyckYW5kJ107XG4gICAgICBwcm9taXNlcy5wdXNoKFxuICAgICAgICAuLi5hbmRzLm1hcCgoYVF1ZXJ5LCBpbmRleCkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlZHVjZUluUmVsYXRpb24oY2xhc3NOYW1lLCBhUXVlcnksIHNjaGVtYSkudGhlbihhUXVlcnkgPT4ge1xuICAgICAgICAgICAgcXVlcnlbJyRhbmQnXVtpbmRleF0gPSBhUXVlcnk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IG90aGVyS2V5cyA9IE9iamVjdC5rZXlzKHF1ZXJ5KS5tYXAoa2V5ID0+IHtcbiAgICAgIGlmIChrZXkgPT09ICckYW5kJyB8fCBrZXkgPT09ICckb3InKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHQgPSBzY2hlbWEuZ2V0RXhwZWN0ZWRUeXBlKGNsYXNzTmFtZSwga2V5KTtcbiAgICAgIGlmICghdCB8fCB0LnR5cGUgIT09ICdSZWxhdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShxdWVyeSk7XG4gICAgICB9XG4gICAgICBsZXQgcXVlcmllczogPyhhbnlbXSkgPSBudWxsO1xuICAgICAgaWYgKFxuICAgICAgICBxdWVyeVtrZXldICYmXG4gICAgICAgIChxdWVyeVtrZXldWyckaW4nXSB8fFxuICAgICAgICAgIHF1ZXJ5W2tleV1bJyRuZSddIHx8XG4gICAgICAgICAgcXVlcnlba2V5XVsnJG5pbiddIHx8XG4gICAgICAgICAgcXVlcnlba2V5XS5fX3R5cGUgPT0gJ1BvaW50ZXInKVxuICAgICAgKSB7XG4gICAgICAgIC8vIEJ1aWxkIHRoZSBsaXN0IG9mIHF1ZXJpZXNcbiAgICAgICAgcXVlcmllcyA9IE9iamVjdC5rZXlzKHF1ZXJ5W2tleV0pLm1hcChjb25zdHJhaW50S2V5ID0+IHtcbiAgICAgICAgICBsZXQgcmVsYXRlZElkcztcbiAgICAgICAgICBsZXQgaXNOZWdhdGlvbiA9IGZhbHNlO1xuICAgICAgICAgIGlmIChjb25zdHJhaW50S2V5ID09PSAnb2JqZWN0SWQnKSB7XG4gICAgICAgICAgICByZWxhdGVkSWRzID0gW3F1ZXJ5W2tleV0ub2JqZWN0SWRdO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWludEtleSA9PSAnJGluJykge1xuICAgICAgICAgICAgcmVsYXRlZElkcyA9IHF1ZXJ5W2tleV1bJyRpbiddLm1hcChyID0+IHIub2JqZWN0SWQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY29uc3RyYWludEtleSA9PSAnJG5pbicpIHtcbiAgICAgICAgICAgIGlzTmVnYXRpb24gPSB0cnVlO1xuICAgICAgICAgICAgcmVsYXRlZElkcyA9IHF1ZXJ5W2tleV1bJyRuaW4nXS5tYXAociA9PiByLm9iamVjdElkKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNvbnN0cmFpbnRLZXkgPT0gJyRuZScpIHtcbiAgICAgICAgICAgIGlzTmVnYXRpb24gPSB0cnVlO1xuICAgICAgICAgICAgcmVsYXRlZElkcyA9IFtxdWVyeVtrZXldWyckbmUnXS5vYmplY3RJZF07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzTmVnYXRpb24sXG4gICAgICAgICAgICByZWxhdGVkSWRzLFxuICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcXVlcmllcyA9IFt7IGlzTmVnYXRpb246IGZhbHNlLCByZWxhdGVkSWRzOiBbXSB9XTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVtb3ZlIHRoZSBjdXJyZW50IHF1ZXJ5S2V5IGFzIHdlIGRvbix0IG5lZWQgaXQgYW55bW9yZVxuICAgICAgZGVsZXRlIHF1ZXJ5W2tleV07XG4gICAgICAvLyBleGVjdXRlIGVhY2ggcXVlcnkgaW5kZXBlbmRlbnRseSB0byBidWlsZCB0aGUgbGlzdCBvZlxuICAgICAgLy8gJGluIC8gJG5pblxuICAgICAgY29uc3QgcHJvbWlzZXMgPSBxdWVyaWVzLm1hcChxID0+IHtcbiAgICAgICAgaWYgKCFxKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm93bmluZ0lkcyhjbGFzc05hbWUsIGtleSwgcS5yZWxhdGVkSWRzKS50aGVuKGlkcyA9PiB7XG4gICAgICAgICAgaWYgKHEuaXNOZWdhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5hZGROb3RJbk9iamVjdElkc0lkcyhpZHMsIHF1ZXJ5KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5hZGRJbk9iamVjdElkc0lkcyhpZHMsIHF1ZXJ5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBQcm9taXNlLmFsbChbLi4ucHJvbWlzZXMsIC4uLm90aGVyS2V5c10pLnRoZW4oKCkgPT4ge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShxdWVyeSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBNb2RpZmllcyBxdWVyeSBzbyB0aGF0IGl0IG5vIGxvbmdlciBoYXMgJHJlbGF0ZWRUb1xuICAvLyBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gcXVlcnkgaXMgbXV0YXRlZFxuICByZWR1Y2VSZWxhdGlvbktleXMoY2xhc3NOYW1lOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHF1ZXJ5T3B0aW9uczogYW55KTogP1Byb21pc2U8dm9pZD4ge1xuICAgIGlmIChxdWVyeVsnJG9yJ10pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLmFsbChcbiAgICAgICAgcXVlcnlbJyRvciddLm1hcChhUXVlcnkgPT4ge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlZHVjZVJlbGF0aW9uS2V5cyhjbGFzc05hbWUsIGFRdWVyeSwgcXVlcnlPcHRpb25zKTtcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuICAgIGlmIChxdWVyeVsnJGFuZCddKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICAgIHF1ZXJ5WyckYW5kJ10ubWFwKGFRdWVyeSA9PiB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlUmVsYXRpb25LZXlzKGNsYXNzTmFtZSwgYVF1ZXJ5LCBxdWVyeU9wdGlvbnMpO1xuICAgICAgICB9KVxuICAgICAgKTtcbiAgICB9XG4gICAgdmFyIHJlbGF0ZWRUbyA9IHF1ZXJ5WyckcmVsYXRlZFRvJ107XG4gICAgaWYgKHJlbGF0ZWRUbykge1xuICAgICAgcmV0dXJuIHRoaXMucmVsYXRlZElkcyhcbiAgICAgICAgcmVsYXRlZFRvLm9iamVjdC5jbGFzc05hbWUsXG4gICAgICAgIHJlbGF0ZWRUby5rZXksXG4gICAgICAgIHJlbGF0ZWRUby5vYmplY3Qub2JqZWN0SWQsXG4gICAgICAgIHF1ZXJ5T3B0aW9uc1xuICAgICAgKVxuICAgICAgICAudGhlbihpZHMgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBxdWVyeVsnJHJlbGF0ZWRUbyddO1xuICAgICAgICAgIHRoaXMuYWRkSW5PYmplY3RJZHNJZHMoaWRzLCBxdWVyeSk7XG4gICAgICAgICAgcmV0dXJuIHRoaXMucmVkdWNlUmVsYXRpb25LZXlzKGNsYXNzTmFtZSwgcXVlcnksIHF1ZXJ5T3B0aW9ucyk7XG4gICAgICAgIH0pXG4gICAgICAgIC50aGVuKCgpID0+IHt9KTtcbiAgICB9XG4gIH1cblxuICBhZGRJbk9iamVjdElkc0lkcyhpZHM6ID9BcnJheTxzdHJpbmc+ID0gbnVsbCwgcXVlcnk6IGFueSkge1xuICAgIGNvbnN0IGlkc0Zyb21TdHJpbmc6ID9BcnJheTxzdHJpbmc+ID1cbiAgICAgIHR5cGVvZiBxdWVyeS5vYmplY3RJZCA9PT0gJ3N0cmluZycgPyBbcXVlcnkub2JqZWN0SWRdIDogbnVsbDtcbiAgICBjb25zdCBpZHNGcm9tRXE6ID9BcnJheTxzdHJpbmc+ID1cbiAgICAgIHF1ZXJ5Lm9iamVjdElkICYmIHF1ZXJ5Lm9iamVjdElkWyckZXEnXSA/IFtxdWVyeS5vYmplY3RJZFsnJGVxJ11dIDogbnVsbDtcbiAgICBjb25zdCBpZHNGcm9tSW46ID9BcnJheTxzdHJpbmc+ID1cbiAgICAgIHF1ZXJ5Lm9iamVjdElkICYmIHF1ZXJ5Lm9iamVjdElkWyckaW4nXSA/IHF1ZXJ5Lm9iamVjdElkWyckaW4nXSA6IG51bGw7XG5cbiAgICAvLyBAZmxvdy1kaXNhYmxlLW5leHRcbiAgICBjb25zdCBhbGxJZHM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW2lkc0Zyb21TdHJpbmcsIGlkc0Zyb21FcSwgaWRzRnJvbUluLCBpZHNdLmZpbHRlcihcbiAgICAgIGxpc3QgPT4gbGlzdCAhPT0gbnVsbFxuICAgICk7XG4gICAgY29uc3QgdG90YWxMZW5ndGggPSBhbGxJZHMucmVkdWNlKChtZW1vLCBsaXN0KSA9PiBtZW1vICsgbGlzdC5sZW5ndGgsIDApO1xuXG4gICAgbGV0IGlkc0ludGVyc2VjdGlvbiA9IFtdO1xuICAgIGlmICh0b3RhbExlbmd0aCA+IDEyNSkge1xuICAgICAgaWRzSW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0LmJpZyhhbGxJZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZHNJbnRlcnNlY3Rpb24gPSBpbnRlcnNlY3QoYWxsSWRzKTtcbiAgICB9XG5cbiAgICAvLyBOZWVkIHRvIG1ha2Ugc3VyZSB3ZSBkb24ndCBjbG9iYmVyIGV4aXN0aW5nIHNob3J0aGFuZCAkZXEgY29uc3RyYWludHMgb24gb2JqZWN0SWQuXG4gICAgaWYgKCEoJ29iamVjdElkJyBpbiBxdWVyeSkpIHtcbiAgICAgIHF1ZXJ5Lm9iamVjdElkID0ge1xuICAgICAgICAkaW46IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcXVlcnkub2JqZWN0SWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBxdWVyeS5vYmplY3RJZCA9IHtcbiAgICAgICAgJGluOiB1bmRlZmluZWQsXG4gICAgICAgICRlcTogcXVlcnkub2JqZWN0SWQsXG4gICAgICB9O1xuICAgIH1cbiAgICBxdWVyeS5vYmplY3RJZFsnJGluJ10gPSBpZHNJbnRlcnNlY3Rpb247XG5cbiAgICByZXR1cm4gcXVlcnk7XG4gIH1cblxuICBhZGROb3RJbk9iamVjdElkc0lkcyhpZHM6IHN0cmluZ1tdID0gW10sIHF1ZXJ5OiBhbnkpIHtcbiAgICBjb25zdCBpZHNGcm9tTmluID0gcXVlcnkub2JqZWN0SWQgJiYgcXVlcnkub2JqZWN0SWRbJyRuaW4nXSA/IHF1ZXJ5Lm9iamVjdElkWyckbmluJ10gOiBbXTtcbiAgICBsZXQgYWxsSWRzID0gWy4uLmlkc0Zyb21OaW4sIC4uLmlkc10uZmlsdGVyKGxpc3QgPT4gbGlzdCAhPT0gbnVsbCk7XG5cbiAgICAvLyBtYWtlIGEgc2V0IGFuZCBzcHJlYWQgdG8gcmVtb3ZlIGR1cGxpY2F0ZXNcbiAgICBhbGxJZHMgPSBbLi4ubmV3IFNldChhbGxJZHMpXTtcblxuICAgIC8vIE5lZWQgdG8gbWFrZSBzdXJlIHdlIGRvbid0IGNsb2JiZXIgZXhpc3Rpbmcgc2hvcnRoYW5kICRlcSBjb25zdHJhaW50cyBvbiBvYmplY3RJZC5cbiAgICBpZiAoISgnb2JqZWN0SWQnIGluIHF1ZXJ5KSkge1xuICAgICAgcXVlcnkub2JqZWN0SWQgPSB7XG4gICAgICAgICRuaW46IHVuZGVmaW5lZCxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcXVlcnkub2JqZWN0SWQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBxdWVyeS5vYmplY3RJZCA9IHtcbiAgICAgICAgJG5pbjogdW5kZWZpbmVkLFxuICAgICAgICAkZXE6IHF1ZXJ5Lm9iamVjdElkLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBxdWVyeS5vYmplY3RJZFsnJG5pbiddID0gYWxsSWRzO1xuICAgIHJldHVybiBxdWVyeTtcbiAgfVxuXG4gIC8vIFJ1bnMgYSBxdWVyeSBvbiB0aGUgZGF0YWJhc2UuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBsaXN0IG9mIGl0ZW1zLlxuICAvLyBPcHRpb25zOlxuICAvLyAgIHNraXAgICAgbnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcC5cbiAgLy8gICBsaW1pdCAgIGxpbWl0IHRvIHRoaXMgbnVtYmVyIG9mIHJlc3VsdHMuXG4gIC8vICAgc29ydCAgICBhbiBvYmplY3Qgd2hlcmUga2V5cyBhcmUgdGhlIGZpZWxkcyB0byBzb3J0IGJ5LlxuICAvLyAgICAgICAgICAgdGhlIHZhbHVlIGlzICsxIGZvciBhc2NlbmRpbmcsIC0xIGZvciBkZXNjZW5kaW5nLlxuICAvLyAgIGNvdW50ICAgcnVuIGEgY291bnQgaW5zdGVhZCBvZiByZXR1cm5pbmcgcmVzdWx0cy5cbiAgLy8gICBhY2wgICAgIHJlc3RyaWN0IHRoaXMgb3BlcmF0aW9uIHdpdGggYW4gQUNMIGZvciB0aGUgcHJvdmlkZWQgYXJyYXlcbiAgLy8gICAgICAgICAgIG9mIHVzZXIgb2JqZWN0SWRzIGFuZCByb2xlcy4gYWNsOiBudWxsIG1lYW5zIG5vIHVzZXIuXG4gIC8vICAgICAgICAgICB3aGVuIHRoaXMgZmllbGQgaXMgbm90IHByZXNlbnQsIGRvbid0IGRvIGFueXRoaW5nIHJlZ2FyZGluZyBBQ0xzLlxuICAvLyAgY2FzZUluc2Vuc2l0aXZlIG1ha2Ugc3RyaW5nIGNvbXBhcmlzb25zIGNhc2UgaW5zZW5zaXRpdmVcbiAgLy8gVE9ETzogbWFrZSB1c2VySWRzIG5vdCBuZWVkZWQgaGVyZS4gVGhlIGRiIGFkYXB0ZXIgc2hvdWxkbid0IGtub3dcbiAgLy8gYW55dGhpbmcgYWJvdXQgdXNlcnMsIGlkZWFsbHkuIFRoZW4sIGltcHJvdmUgdGhlIGZvcm1hdCBvZiB0aGUgQUNMXG4gIC8vIGFyZyB0byB3b3JrIGxpa2UgdGhlIG90aGVycy5cbiAgZmluZChcbiAgICBjbGFzc05hbWU6IHN0cmluZyxcbiAgICBxdWVyeTogYW55LFxuICAgIHtcbiAgICAgIHNraXAsXG4gICAgICBsaW1pdCxcbiAgICAgIGFjbCxcbiAgICAgIHNvcnQgPSB7fSxcbiAgICAgIGNvdW50LFxuICAgICAga2V5cyxcbiAgICAgIG9wLFxuICAgICAgZGlzdGluY3QsXG4gICAgICBwaXBlbGluZSxcbiAgICAgIHJlYWRQcmVmZXJlbmNlLFxuICAgICAgaGludCxcbiAgICAgIGNhc2VJbnNlbnNpdGl2ZSA9IGZhbHNlLFxuICAgICAgZXhwbGFpbixcbiAgICB9OiBhbnkgPSB7fSxcbiAgICBhdXRoOiBhbnkgPSB7fSxcbiAgICB2YWxpZFNjaGVtYUNvbnRyb2xsZXI6IFNjaGVtYUNvbnRyb2xsZXIuU2NoZW1hQ29udHJvbGxlclxuICApOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGlzTWFpbnRlbmFuY2UgPSBhdXRoLmlzTWFpbnRlbmFuY2U7XG4gICAgY29uc3QgaXNNYXN0ZXIgPSBhY2wgPT09IHVuZGVmaW5lZCB8fCBpc01haW50ZW5hbmNlO1xuICAgIGNvbnN0IGFjbEdyb3VwID0gYWNsIHx8IFtdO1xuICAgIG9wID1cbiAgICAgIG9wIHx8ICh0eXBlb2YgcXVlcnkub2JqZWN0SWQgPT0gJ3N0cmluZycgJiYgT2JqZWN0LmtleXMocXVlcnkpLmxlbmd0aCA9PT0gMSA/ICdnZXQnIDogJ2ZpbmQnKTtcbiAgICAvLyBDb3VudCBvcGVyYXRpb24gaWYgY291bnRpbmdcbiAgICBvcCA9IGNvdW50ID09PSB0cnVlID8gJ2NvdW50JyA6IG9wO1xuXG4gICAgbGV0IGNsYXNzRXhpc3RzID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5sb2FkU2NoZW1hSWZOZWVkZWQodmFsaWRTY2hlbWFDb250cm9sbGVyKS50aGVuKHNjaGVtYUNvbnRyb2xsZXIgPT4ge1xuICAgICAgLy9BbGxvdyB2b2xhdGlsZSBjbGFzc2VzIGlmIHF1ZXJ5aW5nIHdpdGggTWFzdGVyIChmb3IgX1B1c2hTdGF0dXMpXG4gICAgICAvL1RPRE86IE1vdmUgdm9sYXRpbGUgY2xhc3NlcyBjb25jZXB0IGludG8gbW9uZ28gYWRhcHRlciwgcG9zdGdyZXMgYWRhcHRlciBzaG91bGRuJ3QgY2FyZVxuICAgICAgLy90aGF0IGFwaS5wYXJzZS5jb20gYnJlYWtzIHdoZW4gX1B1c2hTdGF0dXMgZXhpc3RzIGluIG1vbmdvLlxuICAgICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXJcbiAgICAgICAgLmdldE9uZVNjaGVtYShjbGFzc05hbWUsIGlzTWFzdGVyKVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIC8vIEJlaGF2aW9yIGZvciBub24tZXhpc3RlbnQgY2xhc3NlcyBpcyBraW5kYSB3ZWlyZCBvbiBQYXJzZS5jb20uIFByb2JhYmx5IGRvZXNuJ3QgbWF0dGVyIHRvbyBtdWNoLlxuICAgICAgICAgIC8vIEZvciBub3csIHByZXRlbmQgdGhlIGNsYXNzIGV4aXN0cyBidXQgaGFzIG5vIG9iamVjdHMsXG4gICAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNsYXNzRXhpc3RzID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9KVxuICAgICAgICAudGhlbihzY2hlbWEgPT4ge1xuICAgICAgICAgIC8vIFBhcnNlLmNvbSB0cmVhdHMgcXVlcmllcyBvbiBfY3JlYXRlZF9hdCBhbmQgX3VwZGF0ZWRfYXQgYXMgaWYgdGhleSB3ZXJlIHF1ZXJpZXMgb24gY3JlYXRlZEF0IGFuZCB1cGRhdGVkQXQsXG4gICAgICAgICAgLy8gc28gZHVwbGljYXRlIHRoYXQgYmVoYXZpb3IgaGVyZS4gSWYgYm90aCBhcmUgc3BlY2lmaWVkLCB0aGUgY29ycmVjdCBiZWhhdmlvciB0byBtYXRjaCBQYXJzZS5jb20gaXMgdG9cbiAgICAgICAgICAvLyB1c2UgdGhlIG9uZSB0aGF0IGFwcGVhcnMgZmlyc3QgaW4gdGhlIHNvcnQgbGlzdC5cbiAgICAgICAgICBpZiAoc29ydC5fY3JlYXRlZF9hdCkge1xuICAgICAgICAgICAgc29ydC5jcmVhdGVkQXQgPSBzb3J0Ll9jcmVhdGVkX2F0O1xuICAgICAgICAgICAgZGVsZXRlIHNvcnQuX2NyZWF0ZWRfYXQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzb3J0Ll91cGRhdGVkX2F0KSB7XG4gICAgICAgICAgICBzb3J0LnVwZGF0ZWRBdCA9IHNvcnQuX3VwZGF0ZWRfYXQ7XG4gICAgICAgICAgICBkZWxldGUgc29ydC5fdXBkYXRlZF9hdDtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcXVlcnlPcHRpb25zID0ge1xuICAgICAgICAgICAgc2tpcCxcbiAgICAgICAgICAgIGxpbWl0LFxuICAgICAgICAgICAgc29ydCxcbiAgICAgICAgICAgIGtleXMsXG4gICAgICAgICAgICByZWFkUHJlZmVyZW5jZSxcbiAgICAgICAgICAgIGhpbnQsXG4gICAgICAgICAgICBjYXNlSW5zZW5zaXRpdmUsXG4gICAgICAgICAgICBleHBsYWluLFxuICAgICAgICAgIH07XG4gICAgICAgICAgT2JqZWN0LmtleXMoc29ydCkuZm9yRWFjaChmaWVsZE5hbWUgPT4ge1xuICAgICAgICAgICAgaWYgKGZpZWxkTmFtZS5tYXRjaCgvXmF1dGhEYXRhXFwuKFthLXpBLVowLTlfXSspXFwuaWQkLykpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLklOVkFMSURfS0VZX05BTUUsIGBDYW5ub3Qgc29ydCBieSAke2ZpZWxkTmFtZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJvb3RGaWVsZE5hbWUgPSBnZXRSb290RmllbGROYW1lKGZpZWxkTmFtZSk7XG4gICAgICAgICAgICBpZiAoIVNjaGVtYUNvbnRyb2xsZXIuZmllbGROYW1lSXNWYWxpZChyb290RmllbGROYW1lLCBjbGFzc05hbWUpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihcbiAgICAgICAgICAgICAgICBQYXJzZS5FcnJvci5JTlZBTElEX0tFWV9OQU1FLFxuICAgICAgICAgICAgICAgIGBJbnZhbGlkIGZpZWxkIG5hbWU6ICR7ZmllbGROYW1lfS5gXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXNjaGVtYS5maWVsZHNbZmllbGROYW1lLnNwbGl0KCcuJylbMF1dICYmIGZpZWxkTmFtZSAhPT0gJ3Njb3JlJykge1xuICAgICAgICAgICAgICBkZWxldGUgc29ydFtmaWVsZE5hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybiAoaXNNYXN0ZXJcbiAgICAgICAgICAgID8gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgICAgICAgIDogc2NoZW1hQ29udHJvbGxlci52YWxpZGF0ZVBlcm1pc3Npb24oY2xhc3NOYW1lLCBhY2xHcm91cCwgb3ApXG4gICAgICAgICAgKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5yZWR1Y2VSZWxhdGlvbktleXMoY2xhc3NOYW1lLCBxdWVyeSwgcXVlcnlPcHRpb25zKSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHRoaXMucmVkdWNlSW5SZWxhdGlvbihjbGFzc05hbWUsIHF1ZXJ5LCBzY2hlbWFDb250cm9sbGVyKSlcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgbGV0IHByb3RlY3RlZEZpZWxkcztcbiAgICAgICAgICAgICAgaWYgKCFpc01hc3Rlcikge1xuICAgICAgICAgICAgICAgIHF1ZXJ5ID0gdGhpcy5hZGRQb2ludGVyUGVybWlzc2lvbnMoXG4gICAgICAgICAgICAgICAgICBzY2hlbWFDb250cm9sbGVyLFxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgb3AsXG4gICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgIGFjbEdyb3VwXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAvKiBEb24ndCB1c2UgcHJvamVjdGlvbnMgdG8gb3B0aW1pemUgdGhlIHByb3RlY3RlZEZpZWxkcyBzaW5jZSB0aGUgcHJvdGVjdGVkRmllbGRzXG4gICAgICAgICAgICAgICAgICBiYXNlZCBvbiBwb2ludGVyLXBlcm1pc3Npb25zIGFyZSBkZXRlcm1pbmVkIGFmdGVyIHF1ZXJ5aW5nLiBUaGUgZmlsdGVyaW5nIGNhblxuICAgICAgICAgICAgICAgICAgb3ZlcndyaXRlIHRoZSBwcm90ZWN0ZWQgZmllbGRzLiAqL1xuICAgICAgICAgICAgICAgIHByb3RlY3RlZEZpZWxkcyA9IHRoaXMuYWRkUHJvdGVjdGVkRmllbGRzKFxuICAgICAgICAgICAgICAgICAgc2NoZW1hQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgICAgICAgICAgYWNsR3JvdXAsXG4gICAgICAgICAgICAgICAgICBhdXRoLFxuICAgICAgICAgICAgICAgICAgcXVlcnlPcHRpb25zXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wID09PSAnZ2V0Jykge1xuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQsICdPYmplY3Qgbm90IGZvdW5kLicpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICghaXNNYXN0ZXIpIHtcbiAgICAgICAgICAgICAgICBpZiAob3AgPT09ICd1cGRhdGUnIHx8IG9wID09PSAnZGVsZXRlJykge1xuICAgICAgICAgICAgICAgICAgcXVlcnkgPSBhZGRXcml0ZUFDTChxdWVyeSwgYWNsR3JvdXApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBxdWVyeSA9IGFkZFJlYWRBQ0wocXVlcnksIGFjbEdyb3VwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFsaWRhdGVRdWVyeShxdWVyeSwgaXNNYXN0ZXIsIGlzTWFpbnRlbmFuY2UsIGZhbHNlKTtcbiAgICAgICAgICAgICAgaWYgKGNvdW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjbGFzc0V4aXN0cykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuY291bnQoXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgICAgICAgICAgICBxdWVyeSxcbiAgICAgICAgICAgICAgICAgICAgcmVhZFByZWZlcmVuY2UsXG4gICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgaGludFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZGlzdGluY3QpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNsYXNzRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZGlzdGluY3QoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCBkaXN0aW5jdCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBpcGVsaW5lKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjbGFzc0V4aXN0cykge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmFnZ3JlZ2F0ZShcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICAgICAgICAgIHBpcGVsaW5lLFxuICAgICAgICAgICAgICAgICAgICByZWFkUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICAgICAgaGludCxcbiAgICAgICAgICAgICAgICAgICAgZXhwbGFpblxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoZXhwbGFpbikge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuZmluZChjbGFzc05hbWUsIHNjaGVtYSwgcXVlcnksIHF1ZXJ5T3B0aW9ucyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlclxuICAgICAgICAgICAgICAgICAgLmZpbmQoY2xhc3NOYW1lLCBzY2hlbWEsIHF1ZXJ5LCBxdWVyeU9wdGlvbnMpXG4gICAgICAgICAgICAgICAgICAudGhlbihvYmplY3RzID0+XG4gICAgICAgICAgICAgICAgICAgIG9iamVjdHMubWFwKG9iamVjdCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgb2JqZWN0ID0gdW50cmFuc2Zvcm1PYmplY3RBQ0wob2JqZWN0KTtcbiAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmlsdGVyU2Vuc2l0aXZlRGF0YShcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzTWFzdGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNNYWludGVuYW5jZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjbEdyb3VwLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXV0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NoZW1hQ29udHJvbGxlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3RlY3RlZEZpZWxkcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoUGFyc2UuRXJyb3IuSU5URVJOQUxfU0VSVkVSX0VSUk9SLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZGVsZXRlU2NoZW1hKGNsYXNzTmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IHNjaGVtYUNvbnRyb2xsZXI7XG4gICAgcmV0dXJuIHRoaXMubG9hZFNjaGVtYSh7IGNsZWFyQ2FjaGU6IHRydWUgfSlcbiAgICAgIC50aGVuKHMgPT4ge1xuICAgICAgICBzY2hlbWFDb250cm9sbGVyID0gcztcbiAgICAgICAgcmV0dXJuIHNjaGVtYUNvbnRyb2xsZXIuZ2V0T25lU2NoZW1hKGNsYXNzTmFtZSwgdHJ1ZSk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgaWYgKGVycm9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4geyBmaWVsZHM6IHt9IH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGhlbigoc2NoZW1hOiBhbnkpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29sbGVjdGlvbkV4aXN0cyhjbGFzc05hbWUpXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdGhpcy5hZGFwdGVyLmNvdW50KGNsYXNzTmFtZSwgeyBmaWVsZHM6IHt9IH0sIG51bGwsICcnLCBmYWxzZSkpXG4gICAgICAgICAgLnRoZW4oY291bnQgPT4ge1xuICAgICAgICAgICAgaWYgKGNvdW50ID4gMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgUGFyc2UuRXJyb3IoXG4gICAgICAgICAgICAgICAgMjU1LFxuICAgICAgICAgICAgICAgIGBDbGFzcyAke2NsYXNzTmFtZX0gaXMgbm90IGVtcHR5LCBjb250YWlucyAke2NvdW50fSBvYmplY3RzLCBjYW5ub3QgZHJvcCBzY2hlbWEuYFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRhcHRlci5kZWxldGVDbGFzcyhjbGFzc05hbWUpO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnRoZW4od2FzUGFyc2VDb2xsZWN0aW9uID0+IHtcbiAgICAgICAgICAgIGlmICh3YXNQYXJzZUNvbGxlY3Rpb24pIHtcbiAgICAgICAgICAgICAgY29uc3QgcmVsYXRpb25GaWVsZE5hbWVzID0gT2JqZWN0LmtleXMoc2NoZW1hLmZpZWxkcykuZmlsdGVyKFxuICAgICAgICAgICAgICAgIGZpZWxkTmFtZSA9PiBzY2hlbWEuZmllbGRzW2ZpZWxkTmFtZV0udHlwZSA9PT0gJ1JlbGF0aW9uJ1xuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgcmVsYXRpb25GaWVsZE5hbWVzLm1hcChuYW1lID0+XG4gICAgICAgICAgICAgICAgICB0aGlzLmFkYXB0ZXIuZGVsZXRlQ2xhc3Moam9pblRhYmxlTmFtZShjbGFzc05hbWUsIG5hbWUpKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBTY2hlbWFDYWNoZS5kZWwoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2NoZW1hQ29udHJvbGxlci5yZWxvYWREYXRhKCk7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBUaGlzIGhlbHBzIHRvIGNyZWF0ZSBpbnRlcm1lZGlhdGUgb2JqZWN0cyBmb3Igc2ltcGxlciBjb21wYXJpc29uIG9mXG4gIC8vIGtleSB2YWx1ZSBwYWlycyB1c2VkIGluIHF1ZXJ5IG9iamVjdHMuIEVhY2gga2V5IHZhbHVlIHBhaXIgd2lsbCByZXByZXNlbnRlZFxuICAvLyBpbiBhIHNpbWlsYXIgd2F5IHRvIGpzb25cbiAgb2JqZWN0VG9FbnRyaWVzU3RyaW5ncyhxdWVyeTogYW55KTogQXJyYXk8c3RyaW5nPiB7XG4gICAgcmV0dXJuIE9iamVjdC5lbnRyaWVzKHF1ZXJ5KS5tYXAoYSA9PiBhLm1hcChzID0+IEpTT04uc3RyaW5naWZ5KHMpKS5qb2luKCc6JykpO1xuICB9XG5cbiAgLy8gTmFpdmUgbG9naWMgcmVkdWNlciBmb3IgT1Igb3BlcmF0aW9ucyBtZWFudCB0byBiZSB1c2VkIG9ubHkgZm9yIHBvaW50ZXIgcGVybWlzc2lvbnMuXG4gIHJlZHVjZU9yT3BlcmF0aW9uKHF1ZXJ5OiB7ICRvcjogQXJyYXk8YW55PiB9KTogYW55IHtcbiAgICBpZiAoIXF1ZXJ5LiRvcikge1xuICAgICAgcmV0dXJuIHF1ZXJ5O1xuICAgIH1cbiAgICBjb25zdCBxdWVyaWVzID0gcXVlcnkuJG9yLm1hcChxID0+IHRoaXMub2JqZWN0VG9FbnRyaWVzU3RyaW5ncyhxKSk7XG4gICAgbGV0IHJlcGVhdCA9IGZhbHNlO1xuICAgIGRvIHtcbiAgICAgIHJlcGVhdCA9IGZhbHNlO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBxdWVyaWVzLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCBxdWVyaWVzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgY29uc3QgW3Nob3J0ZXIsIGxvbmdlcl0gPSBxdWVyaWVzW2ldLmxlbmd0aCA+IHF1ZXJpZXNbal0ubGVuZ3RoID8gW2osIGldIDogW2ksIGpdO1xuICAgICAgICAgIGNvbnN0IGZvdW5kRW50cmllcyA9IHF1ZXJpZXNbc2hvcnRlcl0ucmVkdWNlKFxuICAgICAgICAgICAgKGFjYywgZW50cnkpID0+IGFjYyArIChxdWVyaWVzW2xvbmdlcl0uaW5jbHVkZXMoZW50cnkpID8gMSA6IDApLFxuICAgICAgICAgICAgMFxuICAgICAgICAgICk7XG4gICAgICAgICAgY29uc3Qgc2hvcnRlckVudHJpZXMgPSBxdWVyaWVzW3Nob3J0ZXJdLmxlbmd0aDtcbiAgICAgICAgICBpZiAoZm91bmRFbnRyaWVzID09PSBzaG9ydGVyRW50cmllcykge1xuICAgICAgICAgICAgLy8gSWYgdGhlIHNob3J0ZXIgcXVlcnkgaXMgY29tcGxldGVseSBjb250YWluZWQgaW4gdGhlIGxvbmdlciBvbmUsIHdlIGNhbiBzdHJpa2VcbiAgICAgICAgICAgIC8vIG91dCB0aGUgbG9uZ2VyIHF1ZXJ5LlxuICAgICAgICAgICAgcXVlcnkuJG9yLnNwbGljZShsb25nZXIsIDEpO1xuICAgICAgICAgICAgcXVlcmllcy5zcGxpY2UobG9uZ2VyLCAxKTtcbiAgICAgICAgICAgIHJlcGVhdCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IHdoaWxlIChyZXBlYXQpO1xuICAgIGlmIChxdWVyeS4kb3IubGVuZ3RoID09PSAxKSB7XG4gICAgICBxdWVyeSA9IHsgLi4ucXVlcnksIC4uLnF1ZXJ5LiRvclswXSB9O1xuICAgICAgZGVsZXRlIHF1ZXJ5LiRvcjtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLy8gTmFpdmUgbG9naWMgcmVkdWNlciBmb3IgQU5EIG9wZXJhdGlvbnMgbWVhbnQgdG8gYmUgdXNlZCBvbmx5IGZvciBwb2ludGVyIHBlcm1pc3Npb25zLlxuICByZWR1Y2VBbmRPcGVyYXRpb24ocXVlcnk6IHsgJGFuZDogQXJyYXk8YW55PiB9KTogYW55IHtcbiAgICBpZiAoIXF1ZXJ5LiRhbmQpIHtcbiAgICAgIHJldHVybiBxdWVyeTtcbiAgICB9XG4gICAgY29uc3QgcXVlcmllcyA9IHF1ZXJ5LiRhbmQubWFwKHEgPT4gdGhpcy5vYmplY3RUb0VudHJpZXNTdHJpbmdzKHEpKTtcbiAgICBsZXQgcmVwZWF0ID0gZmFsc2U7XG4gICAgZG8ge1xuICAgICAgcmVwZWF0ID0gZmFsc2U7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXJpZXMubGVuZ3RoIC0gMTsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSBpICsgMTsgaiA8IHF1ZXJpZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjb25zdCBbc2hvcnRlciwgbG9uZ2VyXSA9IHF1ZXJpZXNbaV0ubGVuZ3RoID4gcXVlcmllc1tqXS5sZW5ndGggPyBbaiwgaV0gOiBbaSwgal07XG4gICAgICAgICAgY29uc3QgZm91bmRFbnRyaWVzID0gcXVlcmllc1tzaG9ydGVyXS5yZWR1Y2UoXG4gICAgICAgICAgICAoYWNjLCBlbnRyeSkgPT4gYWNjICsgKHF1ZXJpZXNbbG9uZ2VyXS5pbmNsdWRlcyhlbnRyeSkgPyAxIDogMCksXG4gICAgICAgICAgICAwXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBzaG9ydGVyRW50cmllcyA9IHF1ZXJpZXNbc2hvcnRlcl0ubGVuZ3RoO1xuICAgICAgICAgIGlmIChmb3VuZEVudHJpZXMgPT09IHNob3J0ZXJFbnRyaWVzKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgc2hvcnRlciBxdWVyeSBpcyBjb21wbGV0ZWx5IGNvbnRhaW5lZCBpbiB0aGUgbG9uZ2VyIG9uZSwgd2UgY2FuIHN0cmlrZVxuICAgICAgICAgICAgLy8gb3V0IHRoZSBzaG9ydGVyIHF1ZXJ5LlxuICAgICAgICAgICAgcXVlcnkuJGFuZC5zcGxpY2Uoc2hvcnRlciwgMSk7XG4gICAgICAgICAgICBxdWVyaWVzLnNwbGljZShzaG9ydGVyLCAxKTtcbiAgICAgICAgICAgIHJlcGVhdCA9IHRydWU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IHdoaWxlIChyZXBlYXQpO1xuICAgIGlmIChxdWVyeS4kYW5kLmxlbmd0aCA9PT0gMSkge1xuICAgICAgcXVlcnkgPSB7IC4uLnF1ZXJ5LCAuLi5xdWVyeS4kYW5kWzBdIH07XG4gICAgICBkZWxldGUgcXVlcnkuJGFuZDtcbiAgICB9XG4gICAgcmV0dXJuIHF1ZXJ5O1xuICB9XG5cbiAgLy8gQ29uc3RyYWludHMgcXVlcnkgdXNpbmcgQ0xQJ3MgcG9pbnRlciBwZXJtaXNzaW9ucyAoUFApIGlmIGFueS5cbiAgLy8gMS4gRXRyYWN0IHRoZSB1c2VyIGlkIGZyb20gY2FsbGVyJ3MgQUNMZ3JvdXA7XG4gIC8vIDIuIEV4Y3RyYWN0IGEgbGlzdCBvZiBmaWVsZCBuYW1lcyB0aGF0IGFyZSBQUCBmb3IgdGFyZ2V0IGNvbGxlY3Rpb24gYW5kIG9wZXJhdGlvbjtcbiAgLy8gMy4gQ29uc3RyYWludCB0aGUgb3JpZ2luYWwgcXVlcnkgc28gdGhhdCBlYWNoIFBQIGZpZWxkIG11c3RcbiAgLy8gcG9pbnQgdG8gY2FsbGVyJ3MgaWQgKG9yIGNvbnRhaW4gaXQgaW4gY2FzZSBvZiBQUCBmaWVsZCBiZWluZyBhbiBhcnJheSlcbiAgYWRkUG9pbnRlclBlcm1pc3Npb25zKFxuICAgIHNjaGVtYTogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyLFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIG9wZXJhdGlvbjogc3RyaW5nLFxuICAgIHF1ZXJ5OiBhbnksXG4gICAgYWNsR3JvdXA6IGFueVtdID0gW11cbiAgKTogYW55IHtcbiAgICAvLyBDaGVjayBpZiBjbGFzcyBoYXMgcHVibGljIHBlcm1pc3Npb24gZm9yIG9wZXJhdGlvblxuICAgIC8vIElmIHRoZSBCYXNlQ0xQIHBhc3MsIGxldCBnbyB0aHJvdWdoXG4gICAgaWYgKHNjaGVtYS50ZXN0UGVybWlzc2lvbnNGb3JDbGFzc05hbWUoY2xhc3NOYW1lLCBhY2xHcm91cCwgb3BlcmF0aW9uKSkge1xuICAgICAgcmV0dXJuIHF1ZXJ5O1xuICAgIH1cbiAgICBjb25zdCBwZXJtcyA9IHNjaGVtYS5nZXRDbGFzc0xldmVsUGVybWlzc2lvbnMoY2xhc3NOYW1lKTtcblxuICAgIGNvbnN0IHVzZXJBQ0wgPSBhY2xHcm91cC5maWx0ZXIoYWNsID0+IHtcbiAgICAgIHJldHVybiBhY2wuaW5kZXhPZigncm9sZTonKSAhPSAwICYmIGFjbCAhPSAnKic7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncm91cEtleSA9XG4gICAgICBbJ2dldCcsICdmaW5kJywgJ2NvdW50J10uaW5kZXhPZihvcGVyYXRpb24pID4gLTEgPyAncmVhZFVzZXJGaWVsZHMnIDogJ3dyaXRlVXNlckZpZWxkcyc7XG5cbiAgICBjb25zdCBwZXJtRmllbGRzID0gW107XG5cbiAgICBpZiAocGVybXNbb3BlcmF0aW9uXSAmJiBwZXJtc1tvcGVyYXRpb25dLnBvaW50ZXJGaWVsZHMpIHtcbiAgICAgIHBlcm1GaWVsZHMucHVzaCguLi5wZXJtc1tvcGVyYXRpb25dLnBvaW50ZXJGaWVsZHMpO1xuICAgIH1cblxuICAgIGlmIChwZXJtc1tncm91cEtleV0pIHtcbiAgICAgIGZvciAoY29uc3QgZmllbGQgb2YgcGVybXNbZ3JvdXBLZXldKSB7XG4gICAgICAgIGlmICghcGVybUZpZWxkcy5pbmNsdWRlcyhmaWVsZCkpIHtcbiAgICAgICAgICBwZXJtRmllbGRzLnB1c2goZmllbGQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHRoZSBBQ0wgc2hvdWxkIGhhdmUgZXhhY3RseSAxIHVzZXJcbiAgICBpZiAocGVybUZpZWxkcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyB0aGUgQUNMIHNob3VsZCBoYXZlIGV4YWN0bHkgMSB1c2VyXG4gICAgICAvLyBObyB1c2VyIHNldCByZXR1cm4gdW5kZWZpbmVkXG4gICAgICAvLyBJZiB0aGUgbGVuZ3RoIGlzID4gMSwgdGhhdCBtZWFucyB3ZSBkaWRuJ3QgZGUtZHVwZSB1c2VycyBjb3JyZWN0bHlcbiAgICAgIGlmICh1c2VyQUNMLmxlbmd0aCAhPSAxKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHVzZXJJZCA9IHVzZXJBQ0xbMF07XG4gICAgICBjb25zdCB1c2VyUG9pbnRlciA9IHtcbiAgICAgICAgX190eXBlOiAnUG9pbnRlcicsXG4gICAgICAgIGNsYXNzTmFtZTogJ19Vc2VyJyxcbiAgICAgICAgb2JqZWN0SWQ6IHVzZXJJZCxcbiAgICAgIH07XG5cbiAgICAgIGNvbnN0IHF1ZXJpZXMgPSBwZXJtRmllbGRzLm1hcChrZXkgPT4ge1xuICAgICAgICBjb25zdCBmaWVsZERlc2NyaXB0b3IgPSBzY2hlbWEuZ2V0RXhwZWN0ZWRUeXBlKGNsYXNzTmFtZSwga2V5KTtcbiAgICAgICAgY29uc3QgZmllbGRUeXBlID1cbiAgICAgICAgICBmaWVsZERlc2NyaXB0b3IgJiZcbiAgICAgICAgICB0eXBlb2YgZmllbGREZXNjcmlwdG9yID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChmaWVsZERlc2NyaXB0b3IsICd0eXBlJylcbiAgICAgICAgICAgID8gZmllbGREZXNjcmlwdG9yLnR5cGVcbiAgICAgICAgICAgIDogbnVsbDtcblxuICAgICAgICBsZXQgcXVlcnlDbGF1c2U7XG5cbiAgICAgICAgaWYgKGZpZWxkVHlwZSA9PT0gJ1BvaW50ZXInKSB7XG4gICAgICAgICAgLy8gY29uc3RyYWludCBmb3Igc2luZ2xlIHBvaW50ZXIgc2V0dXBcbiAgICAgICAgICBxdWVyeUNsYXVzZSA9IHsgW2tleV06IHVzZXJQb2ludGVyIH07XG4gICAgICAgIH0gZWxzZSBpZiAoZmllbGRUeXBlID09PSAnQXJyYXknKSB7XG4gICAgICAgICAgLy8gY29uc3RyYWludCBmb3IgdXNlcnMtYXJyYXkgc2V0dXBcbiAgICAgICAgICBxdWVyeUNsYXVzZSA9IHsgW2tleV06IHsgJGFsbDogW3VzZXJQb2ludGVyXSB9IH07XG4gICAgICAgIH0gZWxzZSBpZiAoZmllbGRUeXBlID09PSAnT2JqZWN0Jykge1xuICAgICAgICAgIC8vIGNvbnN0cmFpbnQgZm9yIG9iamVjdCBzZXR1cFxuICAgICAgICAgIHF1ZXJ5Q2xhdXNlID0geyBba2V5XTogdXNlclBvaW50ZXIgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgaXMgYSBDTFAgZmllbGQgb2YgYW4gdW5leHBlY3RlZCB0eXBlLiBUaGlzIGNvbmRpdGlvbiBzaG91bGQgbm90IGhhcHBlbiwgd2hpY2ggaXNcbiAgICAgICAgICAvLyB3aHkgaXMgYmVpbmcgdHJlYXRlZCBhcyBhbiBlcnJvci5cbiAgICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICAgIGBBbiB1bmV4cGVjdGVkIGNvbmRpdGlvbiBvY2N1cnJlZCB3aGVuIHJlc29sdmluZyBwb2ludGVyIHBlcm1pc3Npb25zOiAke2NsYXNzTmFtZX0gJHtrZXl9YFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgd2UgYWxyZWFkeSBoYXZlIGEgY29uc3RyYWludCBvbiB0aGUga2V5LCB1c2UgdGhlICRhbmRcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChxdWVyeSwga2V5KSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlZHVjZUFuZE9wZXJhdGlvbih7ICRhbmQ6IFtxdWVyeUNsYXVzZSwgcXVlcnldIH0pO1xuICAgICAgICB9XG4gICAgICAgIC8vIG90aGVyd2lzZSBqdXN0IGFkZCB0aGUgY29uc3RhaW50XG4gICAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBxdWVyeSwgcXVlcnlDbGF1c2UpO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiBxdWVyaWVzLmxlbmd0aCA9PT0gMSA/IHF1ZXJpZXNbMF0gOiB0aGlzLnJlZHVjZU9yT3BlcmF0aW9uKHsgJG9yOiBxdWVyaWVzIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcXVlcnk7XG4gICAgfVxuICB9XG5cbiAgYWRkUHJvdGVjdGVkRmllbGRzKFxuICAgIHNjaGVtYTogU2NoZW1hQ29udHJvbGxlci5TY2hlbWFDb250cm9sbGVyIHwgYW55LFxuICAgIGNsYXNzTmFtZTogc3RyaW5nLFxuICAgIHF1ZXJ5OiBhbnkgPSB7fSxcbiAgICBhY2xHcm91cDogYW55W10gPSBbXSxcbiAgICBhdXRoOiBhbnkgPSB7fSxcbiAgICBxdWVyeU9wdGlvbnM6IEZ1bGxRdWVyeU9wdGlvbnMgPSB7fVxuICApOiBudWxsIHwgc3RyaW5nW10ge1xuICAgIGNvbnN0IHBlcm1zID1cbiAgICAgIHNjaGVtYSAmJiBzY2hlbWEuZ2V0Q2xhc3NMZXZlbFBlcm1pc3Npb25zXG4gICAgICAgID8gc2NoZW1hLmdldENsYXNzTGV2ZWxQZXJtaXNzaW9ucyhjbGFzc05hbWUpXG4gICAgICAgIDogc2NoZW1hO1xuICAgIGlmICghcGVybXMpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgcHJvdGVjdGVkRmllbGRzID0gcGVybXMucHJvdGVjdGVkRmllbGRzO1xuICAgIGlmICghcHJvdGVjdGVkRmllbGRzKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChhY2xHcm91cC5pbmRleE9mKHF1ZXJ5Lm9iamVjdElkKSA+IC0xKSByZXR1cm4gbnVsbDtcblxuICAgIC8vIGZvciBxdWVyaWVzIHdoZXJlIFwia2V5c1wiIGFyZSBzZXQgYW5kIGRvIG5vdCBpbmNsdWRlIGFsbCAndXNlckZpZWxkJzp7ZmllbGR9LFxuICAgIC8vIHdlIGhhdmUgdG8gdHJhbnNwYXJlbnRseSBpbmNsdWRlIGl0LCBhbmQgdGhlbiByZW1vdmUgYmVmb3JlIHJldHVybmluZyB0byBjbGllbnRcbiAgICAvLyBCZWNhdXNlIGlmIHN1Y2gga2V5IG5vdCBwcm9qZWN0ZWQgdGhlIHBlcm1pc3Npb24gd29uJ3QgYmUgZW5mb3JjZWQgcHJvcGVybHlcbiAgICAvLyBQUyB0aGlzIGlzIGNhbGxlZCB3aGVuICdleGNsdWRlS2V5cycgYWxyZWFkeSByZWR1Y2VkIHRvICdrZXlzJ1xuICAgIGNvbnN0IHByZXNlcnZlS2V5cyA9IHF1ZXJ5T3B0aW9ucy5rZXlzO1xuXG4gICAgLy8gdGhlc2UgYXJlIGtleXMgdGhhdCBuZWVkIHRvIGJlIGluY2x1ZGVkIG9ubHlcbiAgICAvLyB0byBiZSBhYmxlIHRvIGFwcGx5IHByb3RlY3RlZEZpZWxkcyBieSBwb2ludGVyXG4gICAgLy8gYW5kIHRoZW4gdW5zZXQgYmVmb3JlIHJldHVybmluZyB0byBjbGllbnQgKGxhdGVyIGluICBmaWx0ZXJTZW5zaXRpdmVGaWVsZHMpXG4gICAgY29uc3Qgc2VydmVyT25seUtleXMgPSBbXTtcblxuICAgIGNvbnN0IGF1dGhlbnRpY2F0ZWQgPSBhdXRoLnVzZXI7XG5cbiAgICAvLyBtYXAgdG8gYWxsb3cgY2hlY2sgd2l0aG91dCBhcnJheSBzZWFyY2hcbiAgICBjb25zdCByb2xlcyA9IChhdXRoLnVzZXJSb2xlcyB8fCBbXSkucmVkdWNlKChhY2MsIHIpID0+IHtcbiAgICAgIGFjY1tyXSA9IHByb3RlY3RlZEZpZWxkc1tyXTtcbiAgICAgIHJldHVybiBhY2M7XG4gICAgfSwge30pO1xuXG4gICAgLy8gYXJyYXkgb2Ygc2V0cyBvZiBwcm90ZWN0ZWQgZmllbGRzLiBzZXBhcmF0ZSBpdGVtIGZvciBlYWNoIGFwcGxpY2FibGUgY3JpdGVyaWFcbiAgICBjb25zdCBwcm90ZWN0ZWRLZXlzU2V0cyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBrZXkgaW4gcHJvdGVjdGVkRmllbGRzKSB7XG4gICAgICAvLyBza2lwIHVzZXJGaWVsZHNcbiAgICAgIGlmIChrZXkuc3RhcnRzV2l0aCgndXNlckZpZWxkOicpKSB7XG4gICAgICAgIGlmIChwcmVzZXJ2ZUtleXMpIHtcbiAgICAgICAgICBjb25zdCBmaWVsZE5hbWUgPSBrZXkuc3Vic3RyaW5nKDEwKTtcbiAgICAgICAgICBpZiAoIXByZXNlcnZlS2V5cy5pbmNsdWRlcyhmaWVsZE5hbWUpKSB7XG4gICAgICAgICAgICAvLyAxLiBwdXQgaXQgdGhlcmUgdGVtcG9yYXJpbHlcbiAgICAgICAgICAgIHF1ZXJ5T3B0aW9ucy5rZXlzICYmIHF1ZXJ5T3B0aW9ucy5rZXlzLnB1c2goZmllbGROYW1lKTtcbiAgICAgICAgICAgIC8vIDIuIHByZXNlcnZlIGl0IGRlbGV0ZSBsYXRlclxuICAgICAgICAgICAgc2VydmVyT25seUtleXMucHVzaChmaWVsZE5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gYWRkIHB1YmxpYyB0aWVyXG4gICAgICBpZiAoa2V5ID09PSAnKicpIHtcbiAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChwcm90ZWN0ZWRGaWVsZHNba2V5XSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXV0aGVudGljYXRlZCkge1xuICAgICAgICBpZiAoa2V5ID09PSAnYXV0aGVudGljYXRlZCcpIHtcbiAgICAgICAgICAvLyBmb3IgbG9nZ2VkIGluIHVzZXJzXG4gICAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChwcm90ZWN0ZWRGaWVsZHNba2V5XSk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocm9sZXNba2V5XSAmJiBrZXkuc3RhcnRzV2l0aCgncm9sZTonKSkge1xuICAgICAgICAgIC8vIGFkZCBhcHBsaWNhYmxlIHJvbGVzXG4gICAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChyb2xlc1trZXldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNoZWNrIGlmIHRoZXJlJ3MgYSBydWxlIGZvciBjdXJyZW50IHVzZXIncyBpZFxuICAgIGlmIChhdXRoZW50aWNhdGVkKSB7XG4gICAgICBjb25zdCB1c2VySWQgPSBhdXRoLnVzZXIuaWQ7XG4gICAgICBpZiAocGVybXMucHJvdGVjdGVkRmllbGRzW3VzZXJJZF0pIHtcbiAgICAgICAgcHJvdGVjdGVkS2V5c1NldHMucHVzaChwZXJtcy5wcm90ZWN0ZWRGaWVsZHNbdXNlcklkXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJlc2VydmUgZmllbGRzIHRvIGJlIHJlbW92ZWQgYmVmb3JlIHNlbmRpbmcgcmVzcG9uc2UgdG8gY2xpZW50XG4gICAgaWYgKHNlcnZlck9ubHlLZXlzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBlcm1zLnByb3RlY3RlZEZpZWxkcy50ZW1wb3JhcnlLZXlzID0gc2VydmVyT25seUtleXM7XG4gICAgfVxuXG4gICAgbGV0IHByb3RlY3RlZEtleXMgPSBwcm90ZWN0ZWRLZXlzU2V0cy5yZWR1Y2UoKGFjYywgbmV4dCkgPT4ge1xuICAgICAgaWYgKG5leHQpIHtcbiAgICAgICAgYWNjLnB1c2goLi4ubmV4dCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWNjO1xuICAgIH0sIFtdKTtcblxuICAgIC8vIGludGVyc2VjdCBhbGwgc2V0cyBvZiBwcm90ZWN0ZWRGaWVsZHNcbiAgICBwcm90ZWN0ZWRLZXlzU2V0cy5mb3JFYWNoKGZpZWxkcyA9PiB7XG4gICAgICBpZiAoZmllbGRzKSB7XG4gICAgICAgIHByb3RlY3RlZEtleXMgPSBwcm90ZWN0ZWRLZXlzLmZpbHRlcih2ID0+IGZpZWxkcy5pbmNsdWRlcyh2KSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcHJvdGVjdGVkS2V5cztcbiAgfVxuXG4gIGNyZWF0ZVRyYW5zYWN0aW9uYWxTZXNzaW9uKCkge1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuY3JlYXRlVHJhbnNhY3Rpb25hbFNlc3Npb24oKS50aGVuKHRyYW5zYWN0aW9uYWxTZXNzaW9uID0+IHtcbiAgICAgIHRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uID0gdHJhbnNhY3Rpb25hbFNlc3Npb247XG4gICAgfSk7XG4gIH1cblxuICBjb21taXRUcmFuc2FjdGlvbmFsU2Vzc2lvbigpIHtcbiAgICBpZiAoIXRoaXMuX3RyYW5zYWN0aW9uYWxTZXNzaW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZXJlIGlzIG5vIHRyYW5zYWN0aW9uYWwgc2Vzc2lvbiB0byBjb21taXQnKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYWRhcHRlci5jb21taXRUcmFuc2FjdGlvbmFsU2Vzc2lvbih0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbikudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbiA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICBhYm9ydFRyYW5zYWN0aW9uYWxTZXNzaW9uKCkge1xuICAgIGlmICghdGhpcy5fdHJhbnNhY3Rpb25hbFNlc3Npb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGhlcmUgaXMgbm8gdHJhbnNhY3Rpb25hbCBzZXNzaW9uIHRvIGFib3J0Jyk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuYWJvcnRUcmFuc2FjdGlvbmFsU2Vzc2lvbih0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbikudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLl90cmFuc2FjdGlvbmFsU2Vzc2lvbiA9IG51bGw7XG4gICAgfSk7XG4gIH1cblxuICAvLyBUT0RPOiBjcmVhdGUgaW5kZXhlcyBvbiBmaXJzdCBjcmVhdGlvbiBvZiBhIF9Vc2VyIG9iamVjdC4gT3RoZXJ3aXNlIGl0J3MgaW1wb3NzaWJsZSB0b1xuICAvLyBoYXZlIGEgUGFyc2UgYXBwIHdpdGhvdXQgaXQgaGF2aW5nIGEgX1VzZXIgY29sbGVjdGlvbi5cbiAgYXN5bmMgcGVyZm9ybUluaXRpYWxpemF0aW9uKCkge1xuICAgIGF3YWl0IHRoaXMuYWRhcHRlci5wZXJmb3JtSW5pdGlhbGl6YXRpb24oe1xuICAgICAgVm9sYXRpbGVDbGFzc2VzU2NoZW1hczogU2NoZW1hQ29udHJvbGxlci5Wb2xhdGlsZUNsYXNzZXNTY2hlbWFzLFxuICAgIH0pO1xuICAgIGNvbnN0IHJlcXVpcmVkVXNlckZpZWxkcyA9IHtcbiAgICAgIGZpZWxkczoge1xuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0LFxuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9Vc2VyLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcXVpcmVkUm9sZUZpZWxkcyA9IHtcbiAgICAgIGZpZWxkczoge1xuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9EZWZhdWx0LFxuICAgICAgICAuLi5TY2hlbWFDb250cm9sbGVyLmRlZmF1bHRDb2x1bW5zLl9Sb2xlLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGNvbnN0IHJlcXVpcmVkSWRlbXBvdGVuY3lGaWVsZHMgPSB7XG4gICAgICBmaWVsZHM6IHtcbiAgICAgICAgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fRGVmYXVsdCxcbiAgICAgICAgLi4uU2NoZW1hQ29udHJvbGxlci5kZWZhdWx0Q29sdW1ucy5fSWRlbXBvdGVuY3ksXG4gICAgICB9LFxuICAgIH07XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZW1hKCkudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnX1VzZXInKSk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZW1hKCkudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnX1JvbGUnKSk7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2NoZW1hKCkudGhlbihzY2hlbWEgPT4gc2NoZW1hLmVuZm9yY2VDbGFzc0V4aXN0cygnX0lkZW1wb3RlbmN5JykpO1xuXG4gICAgYXdhaXQgdGhpcy5hZGFwdGVyLmVuc3VyZVVuaXF1ZW5lc3MoJ19Vc2VyJywgcmVxdWlyZWRVc2VyRmllbGRzLCBbJ3VzZXJuYW1lJ10pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gZW5zdXJlIHVuaXF1ZW5lc3MgZm9yIHVzZXJuYW1lczogJywgZXJyb3IpO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFkYXB0ZXJcbiAgICAgIC5lbnN1cmVJbmRleCgnX1VzZXInLCByZXF1aXJlZFVzZXJGaWVsZHMsIFsndXNlcm5hbWUnXSwgJ2Nhc2VfaW5zZW5zaXRpdmVfdXNlcm5hbWUnLCB0cnVlKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgbG9nZ2VyLndhcm4oJ1VuYWJsZSB0byBjcmVhdGUgY2FzZSBpbnNlbnNpdGl2ZSB1c2VybmFtZSBpbmRleDogJywgZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hZGFwdGVyLmVuc3VyZVVuaXF1ZW5lc3MoJ19Vc2VyJywgcmVxdWlyZWRVc2VyRmllbGRzLCBbJ2VtYWlsJ10pLmNhdGNoKGVycm9yID0+IHtcbiAgICAgIGxvZ2dlci53YXJuKCdVbmFibGUgdG8gZW5zdXJlIHVuaXF1ZW5lc3MgZm9yIHVzZXIgZW1haWwgYWRkcmVzc2VzOiAnLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuYWRhcHRlclxuICAgICAgLmVuc3VyZUluZGV4KCdfVXNlcicsIHJlcXVpcmVkVXNlckZpZWxkcywgWydlbWFpbCddLCAnY2FzZV9pbnNlbnNpdGl2ZV9lbWFpbCcsIHRydWUpXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGNyZWF0ZSBjYXNlIGluc2Vuc2l0aXZlIGVtYWlsIGluZGV4OiAnLCBlcnJvcik7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSk7XG5cbiAgICBhd2FpdCB0aGlzLmFkYXB0ZXIuZW5zdXJlVW5pcXVlbmVzcygnX1JvbGUnLCByZXF1aXJlZFJvbGVGaWVsZHMsIFsnbmFtZSddKS5jYXRjaChlcnJvciA9PiB7XG4gICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGVuc3VyZSB1bmlxdWVuZXNzIGZvciByb2xlIG5hbWU6ICcsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5hZGFwdGVyXG4gICAgICAuZW5zdXJlVW5pcXVlbmVzcygnX0lkZW1wb3RlbmN5JywgcmVxdWlyZWRJZGVtcG90ZW5jeUZpZWxkcywgWydyZXFJZCddKVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgbG9nZ2VyLndhcm4oJ1VuYWJsZSB0byBlbnN1cmUgdW5pcXVlbmVzcyBmb3IgaWRlbXBvdGVuY3kgcmVxdWVzdCBJRDogJywgZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH0pO1xuXG4gICAgY29uc3QgaXNNb25nb0FkYXB0ZXIgPSB0aGlzLmFkYXB0ZXIgaW5zdGFuY2VvZiBNb25nb1N0b3JhZ2VBZGFwdGVyO1xuICAgIGNvbnN0IGlzUG9zdGdyZXNBZGFwdGVyID0gdGhpcy5hZGFwdGVyIGluc3RhbmNlb2YgUG9zdGdyZXNTdG9yYWdlQWRhcHRlcjtcbiAgICBpZiAoaXNNb25nb0FkYXB0ZXIgfHwgaXNQb3N0Z3Jlc0FkYXB0ZXIpIHtcbiAgICAgIGxldCBvcHRpb25zID0ge307XG4gICAgICBpZiAoaXNNb25nb0FkYXB0ZXIpIHtcbiAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICB0dGw6IDAsXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKGlzUG9zdGdyZXNBZGFwdGVyKSB7XG4gICAgICAgIG9wdGlvbnMgPSB0aGlzLmlkZW1wb3RlbmN5T3B0aW9ucztcbiAgICAgICAgb3B0aW9ucy5zZXRJZGVtcG90ZW5jeUZ1bmN0aW9uID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHRoaXMuYWRhcHRlclxuICAgICAgICAuZW5zdXJlSW5kZXgoJ19JZGVtcG90ZW5jeScsIHJlcXVpcmVkSWRlbXBvdGVuY3lGaWVsZHMsIFsnZXhwaXJlJ10sICd0dGwnLCBmYWxzZSwgb3B0aW9ucylcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBsb2dnZXIud2FybignVW5hYmxlIHRvIGNyZWF0ZSBUVEwgaW5kZXggZm9yIGlkZW1wb3RlbmN5IGV4cGlyZSBkYXRlOiAnLCBlcnJvcik7XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBhd2FpdCB0aGlzLmFkYXB0ZXIudXBkYXRlU2NoZW1hV2l0aEluZGV4ZXMoKTtcbiAgfVxuXG4gIF9leHBhbmRSZXN1bHRPbktleVBhdGgob2JqZWN0OiBhbnksIGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogYW55IHtcbiAgICBpZiAoa2V5LmluZGV4T2YoJy4nKSA8IDApIHtcbiAgICAgIG9iamVjdFtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfVxuICAgIGNvbnN0IHBhdGggPSBrZXkuc3BsaXQoJy4nKTtcbiAgICBjb25zdCBmaXJzdEtleSA9IHBhdGhbMF07XG4gICAgY29uc3QgbmV4dFBhdGggPSBwYXRoLnNsaWNlKDEpLmpvaW4oJy4nKTtcblxuICAgIC8vIFNjYW4gcmVxdWVzdCBkYXRhIGZvciBkZW5pZWQga2V5d29yZHNcbiAgICBpZiAodGhpcy5vcHRpb25zICYmIHRoaXMub3B0aW9ucy5yZXF1ZXN0S2V5d29yZERlbnlsaXN0KSB7XG4gICAgICAvLyBTY2FuIHJlcXVlc3QgZGF0YSBmb3IgZGVuaWVkIGtleXdvcmRzXG4gICAgICBmb3IgKGNvbnN0IGtleXdvcmQgb2YgdGhpcy5vcHRpb25zLnJlcXVlc3RLZXl3b3JkRGVueWxpc3QpIHtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBVdGlscy5vYmplY3RDb250YWluc0tleVZhbHVlKFxuICAgICAgICAgIHsgW2ZpcnN0S2V5XTogdHJ1ZSwgW25leHRQYXRoXTogdHJ1ZSB9LFxuICAgICAgICAgIGtleXdvcmQua2V5LFxuICAgICAgICAgIHRydWVcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFxuICAgICAgICAgICAgUGFyc2UuRXJyb3IuSU5WQUxJRF9LRVlfTkFNRSxcbiAgICAgICAgICAgIGBQcm9oaWJpdGVkIGtleXdvcmQgaW4gcmVxdWVzdCBkYXRhOiAke0pTT04uc3RyaW5naWZ5KGtleXdvcmQpfS5gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIG9iamVjdFtmaXJzdEtleV0gPSB0aGlzLl9leHBhbmRSZXN1bHRPbktleVBhdGgoXG4gICAgICBvYmplY3RbZmlyc3RLZXldIHx8IHt9LFxuICAgICAgbmV4dFBhdGgsXG4gICAgICB2YWx1ZVtmaXJzdEtleV1cbiAgICApO1xuICAgIGRlbGV0ZSBvYmplY3Rba2V5XTtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgX3Nhbml0aXplRGF0YWJhc2VSZXN1bHQob3JpZ2luYWxPYmplY3Q6IGFueSwgcmVzdWx0OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0ge307XG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVzcG9uc2UpO1xuICAgIH1cbiAgICBPYmplY3Qua2V5cyhvcmlnaW5hbE9iamVjdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgY29uc3Qga2V5VXBkYXRlID0gb3JpZ2luYWxPYmplY3Rba2V5XTtcbiAgICAgIC8vIGRldGVybWluZSBpZiB0aGF0IHdhcyBhbiBvcFxuICAgICAgaWYgKFxuICAgICAgICBrZXlVcGRhdGUgJiZcbiAgICAgICAgdHlwZW9mIGtleVVwZGF0ZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAga2V5VXBkYXRlLl9fb3AgJiZcbiAgICAgICAgWydBZGQnLCAnQWRkVW5pcXVlJywgJ1JlbW92ZScsICdJbmNyZW1lbnQnXS5pbmRleE9mKGtleVVwZGF0ZS5fX29wKSA+IC0xXG4gICAgICApIHtcbiAgICAgICAgLy8gb25seSB2YWxpZCBvcHMgdGhhdCBwcm9kdWNlIGFuIGFjdGlvbmFibGUgcmVzdWx0XG4gICAgICAgIC8vIHRoZSBvcCBtYXkgaGF2ZSBoYXBwZW5lZCBvbiBhIGtleXBhdGhcbiAgICAgICAgdGhpcy5fZXhwYW5kUmVzdWx0T25LZXlQYXRoKHJlc3BvbnNlLCBrZXksIHJlc3VsdCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXNwb25zZSk7XG4gIH1cblxuICBzdGF0aWMgX3ZhbGlkYXRlUXVlcnk6IChhbnksIGJvb2xlYW4sIGJvb2xlYW4sIGJvb2xlYW4pID0+IHZvaWQ7XG4gIHN0YXRpYyBmaWx0ZXJTZW5zaXRpdmVEYXRhOiAoYm9vbGVhbiwgYm9vbGVhbiwgYW55W10sIGFueSwgYW55LCBhbnksIHN0cmluZywgYW55W10sIGFueSkgPT4gdm9pZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBEYXRhYmFzZUNvbnRyb2xsZXI7XG4vLyBFeHBvc2UgdmFsaWRhdGVRdWVyeSBmb3IgdGVzdHNcbm1vZHVsZS5leHBvcnRzLl92YWxpZGF0ZVF1ZXJ5ID0gdmFsaWRhdGVRdWVyeTtcbm1vZHVsZS5leHBvcnRzLmZpbHRlclNlbnNpdGl2ZURhdGEgPSBmaWx0ZXJTZW5zaXRpdmVEYXRhO1xuIl0sIm1hcHBpbmdzIjoiOztBQUtBO0FBRUE7QUFFQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFBd0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFLeEQsU0FBU0EsV0FBVyxDQUFDQyxLQUFLLEVBQUVDLEdBQUcsRUFBRTtFQUMvQixNQUFNQyxRQUFRLEdBQUdDLGVBQUMsQ0FBQ0MsU0FB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