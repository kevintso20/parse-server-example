"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Types = void 0;
exports._unregisterAll = _unregisterAll;
exports.addConnectTrigger = addConnectTrigger;
exports.addFunction = addFunction;
exports.addJob = addJob;
exports.addLiveQueryEventHandler = addLiveQueryEventHandler;
exports.addTrigger = addTrigger;
exports.getClassName = getClassName;
exports.getFunction = getFunction;
exports.getFunctionNames = getFunctionNames;
exports.getJob = getJob;
exports.getJobs = getJobs;
exports.getRequestFileObject = getRequestFileObject;
exports.getRequestObject = getRequestObject;
exports.getRequestQueryObject = getRequestQueryObject;
exports.getResponseObject = getResponseObject;
exports.getTrigger = getTrigger;
exports.getValidator = getValidator;
exports.inflate = inflate;
exports.maybeRunAfterFindTrigger = maybeRunAfterFindTrigger;
exports.maybeRunFileTrigger = maybeRunFileTrigger;
exports.maybeRunQueryTrigger = maybeRunQueryTrigger;
exports.maybeRunTrigger = maybeRunTrigger;
exports.maybeRunValidator = maybeRunValidator;
exports.removeFunction = removeFunction;
exports.removeTrigger = removeTrigger;
exports.resolveError = resolveError;
exports.runLiveQueryEventHandlers = runLiveQueryEventHandlers;
exports.runTrigger = runTrigger;
exports.toJSONwithObjects = toJSONwithObjects;
exports.triggerExists = triggerExists;
var _node = _interopRequireDefault(require("parse/node"));
var _logger = require("./logger");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return typeof key === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (typeof input !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (typeof res !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
const Types = {
  beforeLogin: 'beforeLogin',
  afterLogin: 'afterLogin',
  afterLogout: 'afterLogout',
  beforeSave: 'beforeSave',
  afterSave: 'afterSave',
  beforeDelete: 'beforeDelete',
  afterDelete: 'afterDelete',
  beforeFind: 'beforeFind',
  afterFind: 'afterFind',
  beforeConnect: 'beforeConnect',
  beforeSubscribe: 'beforeSubscribe',
  afterEvent: 'afterEvent'
};
exports.Types = Types;
const ConnectClassName = '@Connect';
const baseStore = function () {
  const Validators = Object.keys(Types).reduce(function (base, key) {
    base[key] = {};
    return base;
  }, {});
  const Functions = {};
  const Jobs = {};
  const LiveQuery = [];
  const Triggers = Object.keys(Types).reduce(function (base, key) {
    base[key] = {};
    return base;
  }, {});
  return Object.freeze({
    Functions,
    Jobs,
    Validators,
    Triggers,
    LiveQuery
  });
};
function getClassName(parseClass) {
  if (parseClass && parseClass.className) {
    return parseClass.className;
  }
  if (parseClass && parseClass.name) {
    return parseClass.name.replace('Parse', '@');
  }
  return parseClass;
}
function validateClassNameForTriggers(className, type) {
  if (type == Types.beforeSave && className === '_PushStatus') {
    // _PushStatus uses undocumented nested key increment ops
    // allowing beforeSave would mess up the objects big time
    // TODO: Allow proper documented way of using nested increment ops
    throw 'Only afterSave is allowed on _PushStatus';
  }
  if ((type === Types.beforeLogin || type === Types.afterLogin) && className !== '_User') {
    // TODO: check if upstream code will handle `Error` instance rather
    // than this anti-pattern of throwing strings
    throw 'Only the _User class is allowed for the beforeLogin and afterLogin triggers';
  }
  if (type === Types.afterLogout && className !== '_Session') {
    // TODO: check if upstream code will handle `Error` instance rather
    // than this anti-pattern of throwing strings
    throw 'Only the _Session class is allowed for the afterLogout trigger.';
  }
  if (className === '_Session' && type !== Types.afterLogout) {
    // TODO: check if upstream code will handle `Error` instance rather
    // than this anti-pattern of throwing strings
    throw 'Only the afterLogout trigger is allowed for the _Session class.';
  }
  return className;
}
const _triggerStore = {};
const Category = {
  Functions: 'Functions',
  Validators: 'Validators',
  Jobs: 'Jobs',
  Triggers: 'Triggers'
};
function getStore(category, name, applicationId) {
  const path = name.split('.');
  path.splice(-1); // remove last component
  applicationId = applicationId || _node.default.applicationId;
  _triggerStore[applicationId] = _triggerStore[applicationId] || baseStore();
  let store = _triggerStore[applicationId][category];
  for (const component of path) {
    store = store[component];
    if (!store) {
      return undefined;
    }
  }
  return store;
}
function add(category, name, handler, applicationId) {
  const lastComponent = name.split('.').splice(-1);
  const store = getStore(category, name, applicationId);
  if (store[lastComponent]) {
    _logger.logger.warn(`Warning: Duplicate cloud functions exist for ${lastComponent}. Only the last one will be used and the others will be ignored.`);
  }
  store[lastComponent] = handler;
}
function remove(category, name, applicationId) {
  const lastComponent = name.split('.').splice(-1);
  const store = getStore(category, name, applicationId);
  delete store[lastComponent];
}
function get(category, name, applicationId) {
  const lastComponent = name.split('.').splice(-1);
  const store = getStore(category, name, applicationId);
  return store[lastComponent];
}
function addFunction(functionName, handler, validationHandler, applicationId) {
  add(Category.Functions, functionName, handler, applicationId);
  add(Category.Validators, functionName, validationHandler, applicationId);
}
function addJob(jobName, handler, applicationId) {
  add(Category.Jobs, jobName, handler, applicationId);
}
function addTrigger(type, className, handler, applicationId, validationHandler) {
  validateClassNameForTriggers(className, type);
  add(Category.Triggers, `${type}.${className}`, handler, applicationId);
  add(Category.Validators, `${type}.${className}`, validationHandler, applicationId);
}
function addConnectTrigger(type, handler, applicationId, validationHandler) {
  add(Category.Triggers, `${type}.${ConnectClassName}`, handler, applicationId);
  add(Category.Validators, `${type}.${ConnectClassName}`, validationHandler, applicationId);
}
function addLiveQueryEventHandler(handler, applicationId) {
  applicationId = applicationId || _node.default.applicationId;
  _triggerStore[applicationId] = _triggerStore[applicationId] || baseStore();
  _triggerStore[applicationId].LiveQuery.push(handler);
}
function removeFunction(functionName, applicationId) {
  remove(Category.Functions, functionName, applicationId);
}
function removeTrigger(type, className, applicationId) {
  remove(Category.Triggers, `${type}.${className}`, applicationId);
}
function _unregisterAll() {
  Object.keys(_triggerStore).forEach(appId => delete _triggerStore[appId]);
}
function toJSONwithObjects(object, className) {
  if (!object || !object.toJSON) {
    return {};
  }
  const toJSON = object.toJSON();
  const stateController = _node.default.CoreManager.getObjectStateController();
  const [pending] = stateController.getPendingOps(object._getStateIdentifier());
  for (const key in pending) {
    const val = object.get(key);
    if (!val || !val._toFullJSON) {
      toJSON[key] = val;
      continue;
    }
    toJSON[key] = val._toFullJSON();
  }
  if (className) {
    toJSON.className = className;
  }
  return toJSON;
}
function getTrigger(className, triggerType, applicationId) {
  if (!applicationId) {
    throw 'Missing ApplicationID';
  }
  return get(Category.Triggers, `${triggerType}.${className}`, applicationId);
}
async function runTrigger(trigger, name, request, auth) {
  if (!trigger) {
    return;
  }
  await maybeRunValidator(request, name, auth);
  if (request.skipWithMasterKey) {
    return;
  }
  return await trigger(request);
}
function triggerExists(className, type, applicationId) {
  return getTrigger(className, type, applicationId) != undefined;
}
function getFunction(functionName, applicationId) {
  return get(Category.Functions, functionName, applicationId);
}
function getFunctionNames(applicationId) {
  const store = _triggerStore[applicationId] && _triggerStore[applicationId][Category.Functions] || {};
  const functionNames = [];
  const extractFunctionNames = (namespace, store) => {
    Object.keys(store).forEach(name => {
      const value = store[name];
      if (namespace) {
        name = `${namespace}.${name}`;
      }
      if (typeof value === 'function') {
        functionNames.push(name);
      } else {
        extractFunctionNames(name, value);
      }
    });
  };
  extractFunctionNames(null, store);
  return functionNames;
}
function getJob(jobName, applicationId) {
  return get(Category.Jobs, jobName, applicationId);
}
function getJobs(applicationId) {
  var manager = _triggerStore[applicationId];
  if (manager && manager.Jobs) {
    return manager.Jobs;
  }
  return undefined;
}
function getValidator(functionName, applicationId) {
  return get(Category.Validators, functionName, applicationId);
}
function getRequestObject(triggerType, auth, parseObject, originalParseObject, config, context) {
  const request = {
    triggerName: triggerType,
    object: parseObject,
    master: false,
    log: config.loggerController,
    headers: config.headers,
    ip: config.ip
  };
  if (originalParseObject) {
    request.original = originalParseObject;
  }
  if (triggerType === Types.beforeSave || triggerType === Types.afterSave || triggerType === Types.beforeDelete || triggerType === Types.afterDelete || triggerType === Types.afterFind) {
    // Set a copy of the context on the request object.
    request.context = Object.assign({}, context);
  }
  if (!auth) {
    return request;
  }
  if (auth.isMaster) {
    request['master'] = true;
  }
  if (auth.user) {
    request['user'] = auth.user;
  }
  if (auth.installationId) {
    request['installationId'] = auth.installationId;
  }
  return request;
}
function getRequestQueryObject(triggerType, auth, query, count, config, context, isGet) {
  isGet = !!isGet;
  var request = {
    triggerName: triggerType,
    query,
    master: false,
    count,
    log: config.loggerController,
    isGet,
    headers: config.headers,
    ip: config.ip,
    context: context || {}
  };
  if (!auth) {
    return request;
  }
  if (auth.isMaster) {
    request['master'] = true;
  }
  if (auth.user) {
    request['user'] = auth.user;
  }
  if (auth.installationId) {
    request['installationId'] = auth.installationId;
  }
  return request;
}

// Creates the response object, and uses the request object to pass data
// The API will call this with REST API formatted objects, this will
// transform them to Parse.Object instances expected by Cloud Code.
// Any changes made to the object in a beforeSave will be included.
function getResponseObject(request, resolve, reject) {
  return {
    success: function (response) {
      if (request.triggerName === Types.afterFind) {
        if (!response) {
          response = request.objects;
        }
        response = response.map(object => {
          return toJSONwithObjects(object);
        });
        return resolve(response);
      }
      // Use the JSON response
      if (response && typeof response === 'object' && !request.object.equals(response) && request.triggerName === Types.beforeSave) {
        return resolve(response);
      }
      if (response && typeof response === 'object' && request.triggerName === Types.afterSave) {
        return resolve(response);
      }
      if (request.triggerName === Types.afterSave) {
        return resolve();
      }
      response = {};
      if (request.triggerName === Types.beforeSave) {
        response['object'] = request.object._getSaveJSON();
        response['object']['objectId'] = request.object.id;
      }
      return resolve(response);
    },
    error: function (error) {
      const e = resolveError(error, {
        code: _node.default.Error.SCRIPT_FAILED,
        message: 'Script failed. Unknown error.'
      });
      reject(e);
    }
  };
}
function userIdForLog(auth) {
  return auth && auth.user ? auth.user.id : undefined;
}
function logTriggerAfterHook(triggerType, className, input, auth, logLevel) {
  const cleanInput = _logger.logger.truncateLogMessage(JSON.stringify(input));
  _logger.logger[logLevel](`${triggerType} triggered for ${className} for user ${userIdForLog(auth)}:\n  Input: ${cleanInput}`, {
    className,
    triggerType,
    user: userIdForLog(auth)
  });
}
function logTriggerSuccessBeforeHook(triggerType, className, input, result, auth, logLevel) {
  const cleanInput = _logger.logger.truncateLogMessage(JSON.stringify(input));
  const cleanResult = _logger.logger.truncateLogMessage(JSON.stringify(result));
  _logger.logger[logLevel](`${triggerType} triggered for ${className} for user ${userIdForLog(auth)}:\n  Input: ${cleanInput}\n  Result: ${cleanResult}`, {
    className,
    triggerType,
    user: userIdForLog(auth)
  });
}
function logTriggerErrorBeforeHook(triggerType, className, input, auth, error, logLevel) {
  const cleanInput = _logger.logger.truncateLogMessage(JSON.stringify(input));
  _logger.logger[logLevel](`${triggerType} failed for ${className} for user ${userIdForLog(auth)}:\n  Input: ${cleanInput}\n  Error: ${JSON.stringify(error)}`, {
    className,
    triggerType,
    error,
    user: userIdForLog(auth)
  });
}
function maybeRunAfterFindTrigger(triggerType, auth, className, objects, config, query, context) {
  return new Promise((resolve, reject) => {
    const trigger = getTrigger(className, triggerType, config.applicationId);
    if (!trigger) {
      return resolve();
    }
    const request = getRequestObject(triggerType, auth, null, null, config, context);
    if (query) {
      request.query = query;
    }
    const {
      success,
      error
    } = getResponseObject(request, object => {
      resolve(object);
    }, error => {
      reject(error);
    });
    logTriggerSuccessBeforeHook(triggerType, className, 'AfterFind', JSON.stringify(objects), auth, config.logLevels.triggerBeforeSuccess);
    request.objects = objects.map(object => {
      //setting the class name to transform into parse object
      object.className = className;
      return _node.default.Object.fromJSON(object);
    });
    return Promise.resolve().then(() => {
      return maybeRunValidator(request, `${triggerType}.${className}`, auth);
    }).then(() => {
      if (request.skipWithMasterKey) {
        return request.objects;
      }
      const response = trigger(request);
      if (response && typeof response.then === 'function') {
        return response.then(results => {
          return results;
        });
      }
      return response;
    }).then(success, error);
  }).then(results => {
    logTriggerAfterHook(triggerType, className, JSON.stringify(results), auth, config.logLevels.triggerAfter);
    return results;
  });
}
function maybeRunQueryTrigger(triggerType, className, restWhere, restOptions, config, auth, context, isGet) {
  const trigger = getTrigger(className, triggerType, config.applicationId);
  if (!trigger) {
    return Promise.resolve({
      restWhere,
      restOptions
    });
  }
  const json = Object.assign({}, restOptions);
  json.where = restWhere;
  const parseQuery = new _node.default.Query(className);
  parseQuery.withJSON(json);
  let count = false;
  if (restOptions) {
    count = !!restOptions.count;
  }
  const requestObject = getRequestQueryObject(triggerType, auth, parseQuery, count, config, context, isGet);
  return Promise.resolve().then(() => {
    return maybeRunValidator(requestObject, `${triggerType}.${className}`, auth);
  }).then(() => {
    if (requestObject.skipWithMasterKey) {
      return requestObject.query;
    }
    return trigger(requestObject);
  }).then(result => {
    let queryResult = parseQuery;
    if (result && result instanceof _node.default.Query) {
      queryResult = result;
    }
    const jsonQuery = queryResult.toJSON();
    if (jsonQuery.where) {
      restWhere = jsonQuery.where;
    }
    if (jsonQuery.limit) {
      restOptions = restOptions || {};
      restOptions.limit = jsonQuery.limit;
    }
    if (jsonQuery.skip) {
      restOptions = restOptions || {};
      restOptions.skip = jsonQuery.skip;
    }
    if (jsonQuery.include) {
      restOptions = restOptions || {};
      restOptions.include = jsonQuery.include;
    }
    if (jsonQuery.excludeKeys) {
      restOptions = restOptions || {};
      restOptions.excludeKeys = jsonQuery.excludeKeys;
    }
    if (jsonQuery.explain) {
      restOptions = restOptions || {};
      restOptions.explain = jsonQuery.explain;
    }
    if (jsonQuery.keys) {
      restOptions = restOptions || {};
      restOptions.keys = jsonQuery.keys;
    }
    if (jsonQuery.order) {
      restOptions = restOptions || {};
      restOptions.order = jsonQuery.order;
    }
    if (jsonQuery.hint) {
      restOptions = restOptions || {};
      restOptions.hint = jsonQuery.hint;
    }
    if (requestObject.readPreference) {
      restOptions = restOptions || {};
      restOptions.readPreference = requestObject.readPreference;
    }
    if (requestObject.includeReadPreference) {
      restOptions = restOptions || {};
      restOptions.includeReadPreference = requestObject.includeReadPreference;
    }
    if (requestObject.subqueryReadPreference) {
      restOptions = restOptions || {};
      restOptions.subqueryReadPreference = requestObject.subqueryReadPreference;
    }
    return {
      restWhere,
      restOptions
    };
  }, err => {
    const error = resolveError(err, {
      code: _node.default.Error.SCRIPT_FAILED,
      message: 'Script failed. Unknown error.'
    });
    throw error;
  });
}
function resolveError(message, defaultOpts) {
  if (!defaultOpts) {
    defaultOpts = {};
  }
  if (!message) {
    return new _node.default.Error(defaultOpts.code || _node.default.Error.SCRIPT_FAILED, defaultOpts.message || 'Script failed.');
  }
  if (message instanceof _node.default.Error) {
    return message;
  }
  const code = defaultOpts.code || _node.default.Error.SCRIPT_FAILED;
  // If it's an error, mark it as a script failed
  if (typeof message === 'string') {
    return new _node.default.Error(code, message);
  }
  const error = new _node.default.Error(code, message.message || message);
  if (message instanceof Error) {
    error.stack = message.stack;
  }
  return error;
}
function maybeRunValidator(request, functionName, auth) {
  const theValidator = getValidator(functionName, _node.default.applicationId);
  if (!theValidator) {
    return;
  }
  if (typeof theValidator === 'object' && theValidator.skipWithMasterKey && request.master) {
    request.skipWithMasterKey = true;
  }
  return new Promise((resolve, reject) => {
    return Promise.resolve().then(() => {
      return typeof theValidator === 'object' ? builtInTriggerValidator(theValidator, request, auth) : theValidator(request);
    }).then(() => {
      resolve();
    }).catch(e => {
      const error = resolveError(e, {
        code: _node.default.Error.VALIDATION_ERROR,
        message: 'Validation failed.'
      });
      reject(error);
    });
  });
}
async function builtInTriggerValidator(options, request, auth) {
  if (request.master && !options.validateMasterKey) {
    return;
  }
  let reqUser = request.user;
  if (!reqUser && request.object && request.object.className === '_User' && !request.object.existed()) {
    reqUser = request.object;
  }
  if ((options.requireUser || options.requireAnyUserRoles || options.requireAllUserRoles) && !reqUser) {
    throw 'Validation failed. Please login to continue.';
  }
  if (options.requireMaster && !request.master) {
    throw 'Validation failed. Master key is required to complete this request.';
  }
  let params = request.params || {};
  if (request.object) {
    params = request.object.toJSON();
  }
  const requiredParam = key => {
    const value = params[key];
    if (value == null) {
      throw `Validation failed. Please specify data for ${key}.`;
    }
  };
  const validateOptions = async (opt, key, val) => {
    let opts = opt.options;
    if (typeof opts === 'function') {
      try {
        const result = await opts(val);
        if (!result && result != null) {
          throw opt.error || `Validation failed. Invalid value for ${key}.`;
        }
      } catch (e) {
        if (!e) {
          throw opt.error || `Validation failed. Invalid value for ${key}.`;
        }
        throw opt.error || e.message || e;
      }
      return;
    }
    if (!Array.isArray(opts)) {
      opts = [opt.options];
    }
    if (!opts.includes(val)) {
      throw opt.error || `Validation failed. Invalid option for ${key}. Expected: ${opts.join(', ')}`;
    }
  };
  const getType = fn => {
    const match = fn && fn.toString().match(/^\s*function (\w+)/);
    return (match ? match[1] : '').toLowerCase();
  };
  if (Array.isArray(options.fields)) {
    for (const key of options.fields) {
      requiredParam(key);
    }
  } else {
    const optionPromises = [];
    for (const key in options.fields) {
      const opt = options.fields[key];
      let val = params[key];
      if (typeof opt === 'string') {
        requiredParam(opt);
      }
      if (typeof opt === 'object') {
        if (opt.default != null && val == null) {
          val = opt.default;
          params[key] = val;
          if (request.object) {
            request.object.set(key, val);
          }
        }
        if (opt.constant && request.object) {
          if (request.original) {
            request.object.revert(key);
          } else if (opt.default != null) {
            request.object.set(key, opt.default);
          }
        }
        if (opt.required) {
          requiredParam(key);
        }
        const optional = !opt.required && val === undefined;
        if (!optional) {
          if (opt.type) {
            const type = getType(opt.type);
            const valType = Array.isArray(val) ? 'array' : typeof val;
            if (valType !== type) {
              throw `Validation failed. Invalid type for ${key}. Expected: ${type}`;
            }
          }
          if (opt.options) {
            optionPromises.push(validateOptions(opt, key, val));
          }
        }
      }
    }
    await Promise.all(optionPromises);
  }
  let userRoles = options.requireAnyUserRoles;
  let requireAllRoles = options.requireAllUserRoles;
  const promises = [Promise.resolve(), Promise.resolve(), Promise.resolve()];
  if (userRoles || requireAllRoles) {
    promises[0] = auth.getUserRoles();
  }
  if (typeof userRoles === 'function') {
    promises[1] = userRoles();
  }
  if (typeof requireAllRoles === 'function') {
    promises[2] = requireAllRoles();
  }
  const [roles, resolvedUserRoles, resolvedRequireAll] = await Promise.all(promises);
  if (resolvedUserRoles && Array.isArray(resolvedUserRoles)) {
    userRoles = resolvedUserRoles;
  }
  if (resolvedRequireAll && Array.isArray(resolvedRequireAll)) {
    requireAllRoles = resolvedRequireAll;
  }
  if (userRoles) {
    const hasRole = userRoles.some(requiredRole => roles.includes(`role:${requiredRole}`));
    if (!hasRole) {
      throw `Validation failed. User does not match the required roles.`;
    }
  }
  if (requireAllRoles) {
    for (const requiredRole of requireAllRoles) {
      if (!roles.includes(`role:${requiredRole}`)) {
        throw `Validation failed. User does not match all the required roles.`;
      }
    }
  }
  const userKeys = options.requireUserKeys || [];
  if (Array.isArray(userKeys)) {
    for (const key of userKeys) {
      if (!reqUser) {
        throw 'Please login to make this request.';
      }
      if (reqUser.get(key) == null) {
        throw `Validation failed. Please set data for ${key} on your account.`;
      }
    }
  } else if (typeof userKeys === 'object') {
    const optionPromises = [];
    for (const key in options.requireUserKeys) {
      const opt = options.requireUserKeys[key];
      if (opt.options) {
        optionPromises.push(validateOptions(opt, key, reqUser.get(key)));
      }
    }
    await Promise.all(optionPromises);
  }
}

// To be used as part of the promise chain when saving/deleting an object
// Will resolve successfully if no trigger is configured
// Resolves to an object, empty or containing an object key. A beforeSave
// trigger will set the object key to the rest format object to save.
// originalParseObject is optional, we only need that for before/afterSave functions
function maybeRunTrigger(triggerType, auth, parseObject, originalParseObject, config, context) {
  if (!parseObject) {
    return Promise.resolve({});
  }
  return new Promise(function (resolve, reject) {
    var trigger = getTrigger(parseObject.className, triggerType, config.applicationId);
    if (!trigger) return resolve();
    var request = getRequestObject(triggerType, auth, parseObject, originalParseObject, config, context);
    var {
      success,
      error
    } = getResponseObject(request, object => {
      logTriggerSuccessBeforeHook(triggerType, parseObject.className, parseObject.toJSON(), object, auth, triggerType.startsWith('after') ? config.logLevels.triggerAfter : config.logLevels.triggerBeforeSuccess);
      if (triggerType === Types.beforeSave || triggerType === Types.afterSave || triggerType === Types.beforeDelete || triggerType === Types.afterDelete) {
        Object.assign(context, request.context);
      }
      resolve(object);
    }, error => {
      logTriggerErrorBeforeHook(triggerType, parseObject.className, parseObject.toJSON(), auth, error, config.logLevels.triggerBeforeError);
      reject(error);
    });

    // AfterSave and afterDelete triggers can return a promise, which if they
    // do, needs to be resolved before this promise is resolved,
    // so trigger execution is synced with RestWrite.execute() call.
    // If triggers do not return a promise, they can run async code parallel
    // to the RestWrite.execute() call.
    return Promise.resolve().then(() => {
      return maybeRunValidator(request, `${triggerType}.${parseObject.className}`, auth);
    }).then(() => {
      if (request.skipWithMasterKey) {
        return Promise.resolve();
      }
      const promise = trigger(request);
      if (triggerType === Types.afterSave || triggerType === Types.afterDelete || triggerType === Types.afterLogin) {
        logTriggerAfterHook(triggerType, parseObject.className, parseObject.toJSON(), auth, config.logLevels.triggerAfter);
      }
      // beforeSave is expected to return null (nothing)
      if (triggerType === Types.beforeSave) {
        if (promise && typeof promise.then === 'function') {
          return promise.then(response => {
            // response.object may come from express routing before hook
            if (response && response.object) {
              return response;
            }
            return null;
          });
        }
        return null;
      }
      return promise;
    }).then(success, error);
  });
}

// Converts a REST-format object to a Parse.Object
// data is either className or an object
function inflate(data, restObject) {
  var copy = typeof data == 'object' ? data : {
    className: data
  };
  for (var key in restObject) {
    copy[key] = restObject[key];
  }
  return _node.default.Object.fromJSON(copy);
}
function runLiveQueryEventHandlers(data, applicationId = _node.default.applicationId) {
  if (!_triggerStore || !_triggerStore[applicationId] || !_triggerStore[applicationId].LiveQuery) {
    return;
  }
  _triggerStore[applicationId].LiveQuery.forEach(handler => handler(data));
}
function getRequestFileObject(triggerType, auth, fileObject, config) {
  const request = _objectSpread(_objectSpread({}, fileObject), {}, {
    triggerName: triggerType,
    master: false,
    log: config.loggerController,
    headers: config.headers,
    ip: config.ip
  });
  if (!auth) {
    return request;
  }
  if (auth.isMaster) {
    request['master'] = true;
  }
  if (auth.user) {
    request['user'] = auth.user;
  }
  if (auth.installationId) {
    request['installationId'] = auth.installationId;
  }
  return request;
}
async function maybeRunFileTrigger(triggerType, fileObject, config, auth) {
  const FileClassName = getClassName(_node.default.File);
  const fileTrigger = getTrigger(FileClassName, triggerType, config.applicationId);
  if (typeof fileTrigger === 'function') {
    try {
      const request = getRequestFileObject(triggerType, auth, fileObject, config);
      await maybeRunValidator(request, `${triggerType}.${FileClassName}`, auth);
      if (request.skipWithMasterKey) {
        return fileObject;
      }
      const result = await fileTrigger(request);
      logTriggerSuccessBeforeHook(triggerType, 'Parse.File', _objectSpread(_objectSpread({}, fileObject.file.toJSON()), {}, {
        fileSize: fileObject.fileSize
      }), result, auth, config.logLevels.triggerBeforeSuccess);
      return result || fileObject;
    } catch (error) {
      logTriggerErrorBeforeHook(triggerType, 'Parse.File', _objectSpread(_objectSpread({}, fileObject.file.toJSON()), {}, {
        fileSize: fileObject.fileSize
      }), auth, error, config.logLevels.triggerBeforeError);
      throw error;
    }
  }
  return fileObject;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJUeXBlcyIsImJlZm9yZUxvZ2luIiwiYWZ0ZXJMb2dpbiIsImFmdGVyTG9nb3V0IiwiYmVmb3JlU2F2ZSIsImFmdGVyU2F2ZSIsImJlZm9yZURlbGV0ZSIsImFmdGVyRGVsZXRlIiwiYmVmb3JlRmluZCIsImFmdGVyRmluZCIsImJlZm9yZUNvbm5lY3QiLCJiZWZvcmVTdWJzY3JpYmUiLCJhZnRlckV2ZW50IiwiQ29ubmVjdENsYXNzTmFtZSIsImJhc2VTdG9yZSIsIlZhbGlkYXRvcnMiLCJPYmplY3QiLCJrZXlzIiwicmVkdWNlIiwiYmFzZSIsImtleSIsIkZ1bmN0aW9ucyIsIkpvYnMiLCJMaXZlUXVlcnkiLCJUcmlnZ2VycyIsImZyZWV6ZSIsImdldENsYXNzTmFtZSIsInBhcnNlQ2xhc3MiLCJjbGFzc05hbWUiLCJuYW1lIiwicmVwbGFjZSIsInZhbGlkYXRlQ2xhc3NOYW1lRm9yVHJpZ2dlcnMiLCJ0eXBlIiwiX3RyaWdnZXJTdG9yZSIsIkNhdGVnb3J5IiwiZ2V0U3RvcmUiLCJjYXRlZ29yeSIsImFwcGxpY2F0aW9uSWQiLCJwYXRoIiwic3BsaXQiLCJzcGxpY2UiLCJQYXJzZSIsInN0b3JlIiwiY29tcG9uZW50IiwidW5kZWZpbmVkIiwiYWRkIiwiaGFuZGxlciIsImxhc3RDb21wb25lbnQiLCJsb2dnZXIiLCJ3YXJuIiwicmVtb3ZlIiwiZ2V0IiwiYWRkRnVuY3Rpb24iLCJmdW5jdGlvbk5hbWUiLCJ2YWxpZGF0aW9uSGFuZGxlciIsImFkZEpvYiIsImpvYk5hbWUiLCJhZGRUcmlnZ2VyIiwiYWRkQ29ubmVjdFRyaWdnZXIiLCJhZGRMaXZlUXVlcnlFdmVudEhhbmRsZXIiLCJwdXNoIiwicmVtb3ZlRnVuY3Rpb24iLCJyZW1vdmVUcmlnZ2VyIiwiX3VucmVnaXN0ZXJBbGwiLCJmb3JFYWNoIiwiYXBwSWQiLCJ0b0pTT053aXRoT2JqZWN0cyIsIm9iamVjdCIsInRvSlNPTiIsInN0YXRlQ29udHJvbGxlciIsIkNvcmVNYW5hZ2VyIiwiZ2V0T2JqZWN0U3RhdGVDb250cm9sbGVyIiwicGVuZGluZyIsImdldFBlbmRpbmdPcHMiLCJfZ2V0U3RhdGVJZGVudGlmaWVyIiwidmFsIiwiX3RvRnVsbEpTT04iLCJnZXRUcmlnZ2VyIiwidHJpZ2dlclR5cGUiLCJydW5UcmlnZ2VyIiwidHJpZ2dlciIsInJlcXVlc3QiLCJhdXRoIiwibWF5YmVSdW5WYWxpZGF0b3IiLCJza2lwV2l0aE1hc3RlcktleSIsInRyaWdnZXJFeGlzdHMiLCJnZXRGdW5jdGlvbiIsImdldEZ1bmN0aW9uTmFtZXMiLCJmdW5jdGlvbk5hbWVzIiwiZXh0cmFjdEZ1bmN0aW9uTmFtZXMiLCJuYW1lc3BhY2UiLCJ2YWx1ZSIsImdldEpvYiIsImdldEpvYnMiLCJtYW5hZ2VyIiwiZ2V0VmFsaWRhdG9yIiwiZ2V0UmVxdWVzdE9iamVjdCIsInBhcnNlT2JqZWN0Iiwib3JpZ2luYWxQYXJzZU9iamVjdCIsImNvbmZpZyIsImNvbnRleHQiLCJ0cmlnZ2VyTmFtZSIsIm1hc3RlciIsImxvZyIsImxvZ2dlckNvbnRyb2xsZXIiLCJoZWFkZXJzIiwiaXAiLCJvcmlnaW5hbCIsImFzc2lnbiIsImlzTWFzdGVyIiwidXNlciIsImluc3RhbGxhdGlvbklkIiwiZ2V0UmVxdWVzdFF1ZXJ5T2JqZWN0IiwicXVlcnkiLCJjb3VudCIsImlzR2V0IiwiZ2V0UmVzcG9uc2VPYmplY3QiLCJyZXNvbHZlIiwicmVqZWN0Iiwic3VjY2VzcyIsInJlc3BvbnNlIiwib2JqZWN0cyIsIm1hcCIsImVxdWFscyIsIl9nZXRTYXZlSlNPTiIsImlkIiwiZXJyb3IiLCJlIiwicmVzb2x2ZUVycm9yIiwiY29kZSIsIkVycm9yIiwiU0NSSVBUX0ZBSUxFRCIsIm1lc3NhZ2UiLCJ1c2VySWRGb3JMb2ciLCJsb2dUcmlnZ2VyQWZ0ZXJIb29rIiwiaW5wdXQiLCJsb2dMZXZlbCIsImNsZWFuSW5wdXQiLCJ0cnVuY2F0ZUxvZ01lc3NhZ2UiLCJKU09OIiwic3RyaW5naWZ5IiwibG9nVHJpZ2dlclN1Y2Nlc3NCZWZvcmVIb29rIiwicmVzdWx0IiwiY2xlYW5SZXN1bHQiLCJsb2dUcmlnZ2VyRXJyb3JCZWZvcmVIb29rIiwibWF5YmVSdW5BZnRlckZpbmRUcmlnZ2VyIiwiUHJvbWlzZSIsImxvZ0xldmVscyIsInRyaWdnZXJCZWZvcmVTdWNjZXNzIiwiZnJvbUpTT04iLCJ0aGVuIiwicmVzdWx0cyIsInRyaWdnZXJBZnRlciIsIm1heWJlUnVuUXVlcnlUcmlnZ2VyIiwicmVzdFdoZXJlIiwicmVzdE9wdGlvbnMiLCJqc29uIiwid2hlcmUiLCJwYXJzZVF1ZXJ5IiwiUXVlcnkiLCJ3aXRoSlNPTiIsInJlcXVlc3RPYmplY3QiLCJxdWVyeVJlc3VsdCIsImpzb25RdWVyeSIsImxpbWl0Iiwic2tpcCIsImluY2x1ZGUiLCJleGNsdWRlS2V5cyIsImV4cGxhaW4iLCJvcmRlciIsImhpbnQiLCJyZWFkUHJlZmVyZW5jZSIsImluY2x1ZGVSZWFkUHJlZmVyZW5jZSIsInN1YnF1ZXJ5UmVhZFByZWZlcmVuY2UiLCJlcnIiLCJkZWZhdWx0T3B0cyIsInN0YWNrIiwidGhlVmFsaWRhdG9yIiwiYnVpbHRJblRyaWdnZXJWYWxpZGF0b3IiLCJjYXRjaCIsIlZBTElEQVRJT05fRVJST1IiLCJvcHRpb25zIiwidmFsaWRhdGVNYXN0ZXJLZXkiLCJyZXFVc2VyIiwiZXhpc3RlZCIsInJlcXVpcmVVc2VyIiwicmVxdWlyZUFueVVzZXJSb2xlcyIsInJlcXVpcmVBbGxVc2VyUm9sZXMiLCJyZXF1aXJlTWFzdGVyIiwicGFyYW1zIiwicmVxdWlyZWRQYXJhbSIsInZhbGlkYXRlT3B0aW9ucyIsIm9wdCIsIm9wdHMiLCJBcnJheSIsImlzQXJyYXkiLCJpbmNsdWRlcyIsImpvaW4iLCJnZXRUeXBlIiwiZm4iLCJtYXRjaCIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJmaWVsZHMiLCJvcHRpb25Qcm9taXNlcyIsImRlZmF1bHQiLCJzZXQiLCJjb25zdGFudCIsInJldmVydCIsInJlcXVpcmVkIiwib3B0aW9uYWwiLCJ2YWxUeXBlIiwiYWxsIiwidXNlclJvbGVzIiwicmVxdWlyZUFsbFJvbGVzIiwicHJvbWlzZXMiLCJnZXRVc2VyUm9sZXMiLCJyb2xlcyIsInJlc29sdmVkVXNlclJvbGVzIiwicmVzb2x2ZWRSZXF1aXJlQWxsIiwiaGFzUm9sZSIsInNvbWUiLCJyZXF1aXJlZFJvbGUiLCJ1c2VyS2V5cyIsInJlcXVpcmVVc2VyS2V5cyIsIm1heWJlUnVuVHJpZ2dlciIsInN0YXJ0c1dpdGgiLCJ0cmlnZ2VyQmVmb3JlRXJyb3IiLCJwcm9taXNlIiwiaW5mbGF0ZSIsImRhdGEiLCJyZXN0T2JqZWN0IiwiY29weSIsInJ1bkxpdmVRdWVyeUV2ZW50SGFuZGxlcnMiLCJnZXRSZXF1ZXN0RmlsZU9iamVjdCIsImZpbGVPYmplY3QiLCJtYXliZVJ1bkZpbGVUcmlnZ2VyIiwiRmlsZUNsYXNzTmFtZSIsIkZpbGUiLCJmaWxlVHJpZ2dlciIsImZpbGUiLCJmaWxlU2l6ZSJdLCJzb3VyY2VzIjpbIi4uL3NyYy90cmlnZ2Vycy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0cmlnZ2Vycy5qc1xuaW1wb3J0IFBhcnNlIGZyb20gJ3BhcnNlL25vZGUnO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi9sb2dnZXInO1xuXG5leHBvcnQgY29uc3QgVHlwZXMgPSB7XG4gIGJlZm9yZUxvZ2luOiAnYmVmb3JlTG9naW4nLFxuICBhZnRlckxvZ2luOiAnYWZ0ZXJMb2dpbicsXG4gIGFmdGVyTG9nb3V0OiAnYWZ0ZXJMb2dvdXQnLFxuICBiZWZvcmVTYXZlOiAnYmVmb3JlU2F2ZScsXG4gIGFmdGVyU2F2ZTogJ2FmdGVyU2F2ZScsXG4gIGJlZm9yZURlbGV0ZTogJ2JlZm9yZURlbGV0ZScsXG4gIGFmdGVyRGVsZXRlOiAnYWZ0ZXJEZWxldGUnLFxuICBiZWZvcmVGaW5kOiAnYmVmb3JlRmluZCcsXG4gIGFmdGVyRmluZDogJ2FmdGVyRmluZCcsXG4gIGJlZm9yZUNvbm5lY3Q6ICdiZWZvcmVDb25uZWN0JyxcbiAgYmVmb3JlU3Vic2NyaWJlOiAnYmVmb3JlU3Vic2NyaWJlJyxcbiAgYWZ0ZXJFdmVudDogJ2FmdGVyRXZlbnQnLFxufTtcblxuY29uc3QgQ29ubmVjdENsYXNzTmFtZSA9ICdAQ29ubmVjdCc7XG5cbmNvbnN0IGJhc2VTdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgVmFsaWRhdG9ycyA9IE9iamVjdC5rZXlzKFR5cGVzKS5yZWR1Y2UoZnVuY3Rpb24gKGJhc2UsIGtleSkge1xuICAgIGJhc2Vba2V5XSA9IHt9O1xuICAgIHJldHVybiBiYXNlO1xuICB9LCB7fSk7XG4gIGNvbnN0IEZ1bmN0aW9ucyA9IHt9O1xuICBjb25zdCBKb2JzID0ge307XG4gIGNvbnN0IExpdmVRdWVyeSA9IFtdO1xuICBjb25zdCBUcmlnZ2VycyA9IE9iamVjdC5rZXlzKFR5cGVzKS5yZWR1Y2UoZnVuY3Rpb24gKGJhc2UsIGtleSkge1xuICAgIGJhc2Vba2V5XSA9IHt9O1xuICAgIHJldHVybiBiYXNlO1xuICB9LCB7fSk7XG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoe1xuICAgIEZ1bmN0aW9ucyxcbiAgICBKb2JzLFxuICAgIFZhbGlkYXRvcnMsXG4gICAgVHJpZ2dlcnMsXG4gICAgTGl2ZVF1ZXJ5LFxuICB9KTtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRDbGFzc05hbWUocGFyc2VDbGFzcykge1xuICBpZiAocGFyc2VDbGFzcyAmJiBwYXJzZUNsYXNzLmNsYXNzTmFtZSkge1xuICAgIHJldHVybiBwYXJzZUNsYXNzLmNsYXNzTmFtZTtcbiAgfVxuICBpZiAocGFyc2VDbGFzcyAmJiBwYXJzZUNsYXNzLm5hbWUpIHtcbiAgICByZXR1cm4gcGFyc2VDbGFzcy5uYW1lLnJlcGxhY2UoJ1BhcnNlJywgJ0AnKTtcbiAgfVxuICByZXR1cm4gcGFyc2VDbGFzcztcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVDbGFzc05hbWVGb3JUcmlnZ2VycyhjbGFzc05hbWUsIHR5cGUpIHtcbiAgaWYgKHR5cGUgPT0gVHlwZXMuYmVmb3JlU2F2ZSAmJiBjbGFzc05hbWUgPT09ICdfUHVzaFN0YXR1cycpIHtcbiAgICAvLyBfUHVzaFN0YXR1cyB1c2VzIHVuZG9jdW1lbnRlZCBuZXN0ZWQga2V5IGluY3JlbWVudCBvcHNcbiAgICAvLyBhbGxvd2luZyBiZWZvcmVTYXZlIHdvdWxkIG1lc3MgdXAgdGhlIG9iamVjdHMgYmlnIHRpbWVcbiAgICAvLyBUT0RPOiBBbGxvdyBwcm9wZXIgZG9jdW1lbnRlZCB3YXkgb2YgdXNpbmcgbmVzdGVkIGluY3JlbWVudCBvcHNcbiAgICB0aHJvdyAnT25seSBhZnRlclNhdmUgaXMgYWxsb3dlZCBvbiBfUHVzaFN0YXR1cyc7XG4gIH1cbiAgaWYgKCh0eXBlID09PSBUeXBlcy5iZWZvcmVMb2dpbiB8fCB0eXBlID09PSBUeXBlcy5hZnRlckxvZ2luKSAmJiBjbGFzc05hbWUgIT09ICdfVXNlcicpIHtcbiAgICAvLyBUT0RPOiBjaGVjayBpZiB1cHN0cmVhbSBjb2RlIHdpbGwgaGFuZGxlIGBFcnJvcmAgaW5zdGFuY2UgcmF0aGVyXG4gICAgLy8gdGhhbiB0aGlzIGFudGktcGF0dGVybiBvZiB0aHJvd2luZyBzdHJpbmdzXG4gICAgdGhyb3cgJ09ubHkgdGhlIF9Vc2VyIGNsYXNzIGlzIGFsbG93ZWQgZm9yIHRoZSBiZWZvcmVMb2dpbiBhbmQgYWZ0ZXJMb2dpbiB0cmlnZ2Vycyc7XG4gIH1cbiAgaWYgKHR5cGUgPT09IFR5cGVzLmFmdGVyTG9nb3V0ICYmIGNsYXNzTmFtZSAhPT0gJ19TZXNzaW9uJykge1xuICAgIC8vIFRPRE86IGNoZWNrIGlmIHVwc3RyZWFtIGNvZGUgd2lsbCBoYW5kbGUgYEVycm9yYCBpbnN0YW5jZSByYXRoZXJcbiAgICAvLyB0aGFuIHRoaXMgYW50aS1wYXR0ZXJuIG9mIHRocm93aW5nIHN0cmluZ3NcbiAgICB0aHJvdyAnT25seSB0aGUgX1Nlc3Npb24gY2xhc3MgaXMgYWxsb3dlZCBmb3IgdGhlIGFmdGVyTG9nb3V0IHRyaWdnZXIuJztcbiAgfVxuICBpZiAoY2xhc3NOYW1lID09PSAnX1Nlc3Npb24nICYmIHR5cGUgIT09IFR5cGVzLmFmdGVyTG9nb3V0KSB7XG4gICAgLy8gVE9ETzogY2hlY2sgaWYgdXBzdHJlYW0gY29kZSB3aWxsIGhhbmRsZSBgRXJyb3JgIGluc3RhbmNlIHJhdGhlclxuICAgIC8vIHRoYW4gdGhpcyBhbnRpLXBhdHRlcm4gb2YgdGhyb3dpbmcgc3RyaW5nc1xuICAgIHRocm93ICdPbmx5IHRoZSBhZnRlckxvZ291dCB0cmlnZ2VyIGlzIGFsbG93ZWQgZm9yIHRoZSBfU2Vzc2lvbiBjbGFzcy4nO1xuICB9XG4gIHJldHVybiBjbGFzc05hbWU7XG59XG5cbmNvbnN0IF90cmlnZ2VyU3RvcmUgPSB7fTtcblxuY29uc3QgQ2F0ZWdvcnkgPSB7XG4gIEZ1bmN0aW9uczogJ0Z1bmN0aW9ucycsXG4gIFZhbGlkYXRvcnM6ICdWYWxpZGF0b3JzJyxcbiAgSm9iczogJ0pvYnMnLFxuICBUcmlnZ2VyczogJ1RyaWdnZXJzJyxcbn07XG5cbmZ1bmN0aW9uIGdldFN0b3JlKGNhdGVnb3J5LCBuYW1lLCBhcHBsaWNhdGlvbklkKSB7XG4gIGNvbnN0IHBhdGggPSBuYW1lLnNwbGl0KCcuJyk7XG4gIHBhdGguc3BsaWNlKC0xKTsgLy8gcmVtb3ZlIGxhc3QgY29tcG9uZW50XG4gIGFwcGxpY2F0aW9uSWQgPSBhcHBsaWNhdGlvbklkIHx8IFBhcnNlLmFwcGxpY2F0aW9uSWQ7XG4gIF90cmlnZ2VyU3RvcmVbYXBwbGljYXRpb25JZF0gPSBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdIHx8IGJhc2VTdG9yZSgpO1xuICBsZXQgc3RvcmUgPSBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdW2NhdGVnb3J5XTtcbiAgZm9yIChjb25zdCBjb21wb25lbnQgb2YgcGF0aCkge1xuICAgIHN0b3JlID0gc3RvcmVbY29tcG9uZW50XTtcbiAgICBpZiAoIXN0b3JlKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RvcmU7XG59XG5cbmZ1bmN0aW9uIGFkZChjYXRlZ29yeSwgbmFtZSwgaGFuZGxlciwgYXBwbGljYXRpb25JZCkge1xuICBjb25zdCBsYXN0Q29tcG9uZW50ID0gbmFtZS5zcGxpdCgnLicpLnNwbGljZSgtMSk7XG4gIGNvbnN0IHN0b3JlID0gZ2V0U3RvcmUoY2F0ZWdvcnksIG5hbWUsIGFwcGxpY2F0aW9uSWQpO1xuICBpZiAoc3RvcmVbbGFzdENvbXBvbmVudF0pIHtcbiAgICBsb2dnZXIud2FybihcbiAgICAgIGBXYXJuaW5nOiBEdXBsaWNhdGUgY2xvdWQgZnVuY3Rpb25zIGV4aXN0IGZvciAke2xhc3RDb21wb25lbnR9LiBPbmx5IHRoZSBsYXN0IG9uZSB3aWxsIGJlIHVzZWQgYW5kIHRoZSBvdGhlcnMgd2lsbCBiZSBpZ25vcmVkLmBcbiAgICApO1xuICB9XG4gIHN0b3JlW2xhc3RDb21wb25lbnRdID0gaGFuZGxlcjtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlKGNhdGVnb3J5LCBuYW1lLCBhcHBsaWNhdGlvbklkKSB7XG4gIGNvbnN0IGxhc3RDb21wb25lbnQgPSBuYW1lLnNwbGl0KCcuJykuc3BsaWNlKC0xKTtcbiAgY29uc3Qgc3RvcmUgPSBnZXRTdG9yZShjYXRlZ29yeSwgbmFtZSwgYXBwbGljYXRpb25JZCk7XG4gIGRlbGV0ZSBzdG9yZVtsYXN0Q29tcG9uZW50XTtcbn1cblxuZnVuY3Rpb24gZ2V0KGNhdGVnb3J5LCBuYW1lLCBhcHBsaWNhdGlvbklkKSB7XG4gIGNvbnN0IGxhc3RDb21wb25lbnQgPSBuYW1lLnNwbGl0KCcuJykuc3BsaWNlKC0xKTtcbiAgY29uc3Qgc3RvcmUgPSBnZXRTdG9yZShjYXRlZ29yeSwgbmFtZSwgYXBwbGljYXRpb25JZCk7XG4gIHJldHVybiBzdG9yZVtsYXN0Q29tcG9uZW50XTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEZ1bmN0aW9uKGZ1bmN0aW9uTmFtZSwgaGFuZGxlciwgdmFsaWRhdGlvbkhhbmRsZXIsIGFwcGxpY2F0aW9uSWQpIHtcbiAgYWRkKENhdGVnb3J5LkZ1bmN0aW9ucywgZnVuY3Rpb25OYW1lLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbiAgYWRkKENhdGVnb3J5LlZhbGlkYXRvcnMsIGZ1bmN0aW9uTmFtZSwgdmFsaWRhdGlvbkhhbmRsZXIsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkSm9iKGpvYk5hbWUsIGhhbmRsZXIsIGFwcGxpY2F0aW9uSWQpIHtcbiAgYWRkKENhdGVnb3J5LkpvYnMsIGpvYk5hbWUsIGhhbmRsZXIsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkVHJpZ2dlcih0eXBlLCBjbGFzc05hbWUsIGhhbmRsZXIsIGFwcGxpY2F0aW9uSWQsIHZhbGlkYXRpb25IYW5kbGVyKSB7XG4gIHZhbGlkYXRlQ2xhc3NOYW1lRm9yVHJpZ2dlcnMoY2xhc3NOYW1lLCB0eXBlKTtcbiAgYWRkKENhdGVnb3J5LlRyaWdnZXJzLCBgJHt0eXBlfS4ke2NsYXNzTmFtZX1gLCBoYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbiAgYWRkKENhdGVnb3J5LlZhbGlkYXRvcnMsIGAke3R5cGV9LiR7Y2xhc3NOYW1lfWAsIHZhbGlkYXRpb25IYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZENvbm5lY3RUcmlnZ2VyKHR5cGUsIGhhbmRsZXIsIGFwcGxpY2F0aW9uSWQsIHZhbGlkYXRpb25IYW5kbGVyKSB7XG4gIGFkZChDYXRlZ29yeS5UcmlnZ2VycywgYCR7dHlwZX0uJHtDb25uZWN0Q2xhc3NOYW1lfWAsIGhhbmRsZXIsIGFwcGxpY2F0aW9uSWQpO1xuICBhZGQoQ2F0ZWdvcnkuVmFsaWRhdG9ycywgYCR7dHlwZX0uJHtDb25uZWN0Q2xhc3NOYW1lfWAsIHZhbGlkYXRpb25IYW5kbGVyLCBhcHBsaWNhdGlvbklkKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZExpdmVRdWVyeUV2ZW50SGFuZGxlcihoYW5kbGVyLCBhcHBsaWNhdGlvbklkKSB7XG4gIGFwcGxpY2F0aW9uSWQgPSBhcHBsaWNhdGlvbklkIHx8IFBhcnNlLmFwcGxpY2F0aW9uSWQ7XG4gIF90cmlnZ2VyU3RvcmVbYXBwbGljYXRpb25JZF0gPSBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdIHx8IGJhc2VTdG9yZSgpO1xuICBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdLkxpdmVRdWVyeS5wdXNoKGhhbmRsZXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlRnVuY3Rpb24oZnVuY3Rpb25OYW1lLCBhcHBsaWNhdGlvbklkKSB7XG4gIHJlbW92ZShDYXRlZ29yeS5GdW5jdGlvbnMsIGZ1bmN0aW9uTmFtZSwgYXBwbGljYXRpb25JZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVUcmlnZ2VyKHR5cGUsIGNsYXNzTmFtZSwgYXBwbGljYXRpb25JZCkge1xuICByZW1vdmUoQ2F0ZWdvcnkuVHJpZ2dlcnMsIGAke3R5cGV9LiR7Y2xhc3NOYW1lfWAsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gX3VucmVnaXN0ZXJBbGwoKSB7XG4gIE9iamVjdC5rZXlzKF90cmlnZ2VyU3RvcmUpLmZvckVhY2goYXBwSWQgPT4gZGVsZXRlIF90cmlnZ2VyU3RvcmVbYXBwSWRdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvSlNPTndpdGhPYmplY3RzKG9iamVjdCwgY2xhc3NOYW1lKSB7XG4gIGlmICghb2JqZWN0IHx8ICFvYmplY3QudG9KU09OKSB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG4gIGNvbnN0IHRvSlNPTiA9IG9iamVjdC50b0pTT04oKTtcbiAgY29uc3Qgc3RhdGVDb250cm9sbGVyID0gUGFyc2UuQ29yZU1hbmFnZXIuZ2V0T2JqZWN0U3RhdGVDb250cm9sbGVyKCk7XG4gIGNvbnN0IFtwZW5kaW5nXSA9IHN0YXRlQ29udHJvbGxlci5nZXRQZW5kaW5nT3BzKG9iamVjdC5fZ2V0U3RhdGVJZGVudGlmaWVyKCkpO1xuICBmb3IgKGNvbnN0IGtleSBpbiBwZW5kaW5nKSB7XG4gICAgY29uc3QgdmFsID0gb2JqZWN0LmdldChrZXkpO1xuICAgIGlmICghdmFsIHx8ICF2YWwuX3RvRnVsbEpTT04pIHtcbiAgICAgIHRvSlNPTltrZXldID0gdmFsO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIHRvSlNPTltrZXldID0gdmFsLl90b0Z1bGxKU09OKCk7XG4gIH1cbiAgaWYgKGNsYXNzTmFtZSkge1xuICAgIHRvSlNPTi5jbGFzc05hbWUgPSBjbGFzc05hbWU7XG4gIH1cbiAgcmV0dXJuIHRvSlNPTjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRyaWdnZXIoY2xhc3NOYW1lLCB0cmlnZ2VyVHlwZSwgYXBwbGljYXRpb25JZCkge1xuICBpZiAoIWFwcGxpY2F0aW9uSWQpIHtcbiAgICB0aHJvdyAnTWlzc2luZyBBcHBsaWNhdGlvbklEJztcbiAgfVxuICByZXR1cm4gZ2V0KENhdGVnb3J5LlRyaWdnZXJzLCBgJHt0cmlnZ2VyVHlwZX0uJHtjbGFzc05hbWV9YCwgYXBwbGljYXRpb25JZCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5UcmlnZ2VyKHRyaWdnZXIsIG5hbWUsIHJlcXVlc3QsIGF1dGgpIHtcbiAgaWYgKCF0cmlnZ2VyKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGF3YWl0IG1heWJlUnVuVmFsaWRhdG9yKHJlcXVlc3QsIG5hbWUsIGF1dGgpO1xuICBpZiAocmVxdWVzdC5za2lwV2l0aE1hc3RlcktleSkge1xuICAgIHJldHVybjtcbiAgfVxuICByZXR1cm4gYXdhaXQgdHJpZ2dlcihyZXF1ZXN0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJFeGlzdHMoY2xhc3NOYW1lOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgYXBwbGljYXRpb25JZDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBnZXRUcmlnZ2VyKGNsYXNzTmFtZSwgdHlwZSwgYXBwbGljYXRpb25JZCkgIT0gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RnVuY3Rpb24oZnVuY3Rpb25OYW1lLCBhcHBsaWNhdGlvbklkKSB7XG4gIHJldHVybiBnZXQoQ2F0ZWdvcnkuRnVuY3Rpb25zLCBmdW5jdGlvbk5hbWUsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RnVuY3Rpb25OYW1lcyhhcHBsaWNhdGlvbklkKSB7XG4gIGNvbnN0IHN0b3JlID1cbiAgICAoX3RyaWdnZXJTdG9yZVthcHBsaWNhdGlvbklkXSAmJiBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdW0NhdGVnb3J5LkZ1bmN0aW9uc10pIHx8IHt9O1xuICBjb25zdCBmdW5jdGlvbk5hbWVzID0gW107XG4gIGNvbnN0IGV4dHJhY3RGdW5jdGlvbk5hbWVzID0gKG5hbWVzcGFjZSwgc3RvcmUpID0+IHtcbiAgICBPYmplY3Qua2V5cyhzdG9yZSkuZm9yRWFjaChuYW1lID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gc3RvcmVbbmFtZV07XG4gICAgICBpZiAobmFtZXNwYWNlKSB7XG4gICAgICAgIG5hbWUgPSBgJHtuYW1lc3BhY2V9LiR7bmFtZX1gO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBmdW5jdGlvbk5hbWVzLnB1c2gobmFtZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBleHRyYWN0RnVuY3Rpb25OYW1lcyhuYW1lLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG4gIGV4dHJhY3RGdW5jdGlvbk5hbWVzKG51bGwsIHN0b3JlKTtcbiAgcmV0dXJuIGZ1bmN0aW9uTmFtZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRKb2Ioam9iTmFtZSwgYXBwbGljYXRpb25JZCkge1xuICByZXR1cm4gZ2V0KENhdGVnb3J5LkpvYnMsIGpvYk5hbWUsIGFwcGxpY2F0aW9uSWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0Sm9icyhhcHBsaWNhdGlvbklkKSB7XG4gIHZhciBtYW5hZ2VyID0gX3RyaWdnZXJTdG9yZVthcHBsaWNhdGlvbklkXTtcbiAgaWYgKG1hbmFnZXIgJiYgbWFuYWdlci5Kb2JzKSB7XG4gICAgcmV0dXJuIG1hbmFnZXIuSm9icztcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VmFsaWRhdG9yKGZ1bmN0aW9uTmFtZSwgYXBwbGljYXRpb25JZCkge1xuICByZXR1cm4gZ2V0KENhdGVnb3J5LlZhbGlkYXRvcnMsIGZ1bmN0aW9uTmFtZSwgYXBwbGljYXRpb25JZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0T2JqZWN0KFxuICB0cmlnZ2VyVHlwZSxcbiAgYXV0aCxcbiAgcGFyc2VPYmplY3QsXG4gIG9yaWdpbmFsUGFyc2VPYmplY3QsXG4gIGNvbmZpZyxcbiAgY29udGV4dFxuKSB7XG4gIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgdHJpZ2dlck5hbWU6IHRyaWdnZXJUeXBlLFxuICAgIG9iamVjdDogcGFyc2VPYmplY3QsXG4gICAgbWFzdGVyOiBmYWxzZSxcbiAgICBsb2c6IGNvbmZpZy5sb2dnZXJDb250cm9sbGVyLFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgIGlwOiBjb25maWcuaXAsXG4gIH07XG5cbiAgaWYgKG9yaWdpbmFsUGFyc2VPYmplY3QpIHtcbiAgICByZXF1ZXN0Lm9yaWdpbmFsID0gb3JpZ2luYWxQYXJzZU9iamVjdDtcbiAgfVxuICBpZiAoXG4gICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmJlZm9yZVNhdmUgfHxcbiAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJTYXZlIHx8XG4gICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmJlZm9yZURlbGV0ZSB8fFxuICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5hZnRlckRlbGV0ZSB8fFxuICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5hZnRlckZpbmRcbiAgKSB7XG4gICAgLy8gU2V0IGEgY29weSBvZiB0aGUgY29udGV4dCBvbiB0aGUgcmVxdWVzdCBvYmplY3QuXG4gICAgcmVxdWVzdC5jb250ZXh0ID0gT2JqZWN0LmFzc2lnbih7fSwgY29udGV4dCk7XG4gIH1cblxuICBpZiAoIWF1dGgpIHtcbiAgICByZXR1cm4gcmVxdWVzdDtcbiAgfVxuICBpZiAoYXV0aC5pc01hc3Rlcikge1xuICAgIHJlcXVlc3RbJ21hc3RlciddID0gdHJ1ZTtcbiAgfVxuICBpZiAoYXV0aC51c2VyKSB7XG4gICAgcmVxdWVzdFsndXNlciddID0gYXV0aC51c2VyO1xuICB9XG4gIGlmIChhdXRoLmluc3RhbGxhdGlvbklkKSB7XG4gICAgcmVxdWVzdFsnaW5zdGFsbGF0aW9uSWQnXSA9IGF1dGguaW5zdGFsbGF0aW9uSWQ7XG4gIH1cbiAgcmV0dXJuIHJlcXVlc3Q7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0UXVlcnlPYmplY3QodHJpZ2dlclR5cGUsIGF1dGgsIHF1ZXJ5LCBjb3VudCwgY29uZmlnLCBjb250ZXh0LCBpc0dldCkge1xuICBpc0dldCA9ICEhaXNHZXQ7XG5cbiAgdmFyIHJlcXVlc3QgPSB7XG4gICAgdHJpZ2dlck5hbWU6IHRyaWdnZXJUeXBlLFxuICAgIHF1ZXJ5LFxuICAgIG1hc3RlcjogZmFsc2UsXG4gICAgY291bnQsXG4gICAgbG9nOiBjb25maWcubG9nZ2VyQ29udHJvbGxlcixcbiAgICBpc0dldCxcbiAgICBoZWFkZXJzOiBjb25maWcuaGVhZGVycyxcbiAgICBpcDogY29uZmlnLmlwLFxuICAgIGNvbnRleHQ6IGNvbnRleHQgfHwge30sXG4gIH07XG5cbiAgaWYgKCFhdXRoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3Q7XG4gIH1cbiAgaWYgKGF1dGguaXNNYXN0ZXIpIHtcbiAgICByZXF1ZXN0WydtYXN0ZXInXSA9IHRydWU7XG4gIH1cbiAgaWYgKGF1dGgudXNlcikge1xuICAgIHJlcXVlc3RbJ3VzZXInXSA9IGF1dGgudXNlcjtcbiAgfVxuICBpZiAoYXV0aC5pbnN0YWxsYXRpb25JZCkge1xuICAgIHJlcXVlc3RbJ2luc3RhbGxhdGlvbklkJ10gPSBhdXRoLmluc3RhbGxhdGlvbklkO1xuICB9XG4gIHJldHVybiByZXF1ZXN0O1xufVxuXG4vLyBDcmVhdGVzIHRoZSByZXNwb25zZSBvYmplY3QsIGFuZCB1c2VzIHRoZSByZXF1ZXN0IG9iamVjdCB0byBwYXNzIGRhdGFcbi8vIFRoZSBBUEkgd2lsbCBjYWxsIHRoaXMgd2l0aCBSRVNUIEFQSSBmb3JtYXR0ZWQgb2JqZWN0cywgdGhpcyB3aWxsXG4vLyB0cmFuc2Zvcm0gdGhlbSB0byBQYXJzZS5PYmplY3QgaW5zdGFuY2VzIGV4cGVjdGVkIGJ5IENsb3VkIENvZGUuXG4vLyBBbnkgY2hhbmdlcyBtYWRlIHRvIHRoZSBvYmplY3QgaW4gYSBiZWZvcmVTYXZlIHdpbGwgYmUgaW5jbHVkZWQuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVzcG9uc2VPYmplY3QocmVxdWVzdCwgcmVzb2x2ZSwgcmVqZWN0KSB7XG4gIHJldHVybiB7XG4gICAgc3VjY2VzczogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICBpZiAocmVxdWVzdC50cmlnZ2VyTmFtZSA9PT0gVHlwZXMuYWZ0ZXJGaW5kKSB7XG4gICAgICAgIGlmICghcmVzcG9uc2UpIHtcbiAgICAgICAgICByZXNwb25zZSA9IHJlcXVlc3Qub2JqZWN0cztcbiAgICAgICAgfVxuICAgICAgICByZXNwb25zZSA9IHJlc3BvbnNlLm1hcChvYmplY3QgPT4ge1xuICAgICAgICAgIHJldHVybiB0b0pTT053aXRoT2JqZWN0cyhvYmplY3QpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgfVxuICAgICAgLy8gVXNlIHRoZSBKU09OIHJlc3BvbnNlXG4gICAgICBpZiAoXG4gICAgICAgIHJlc3BvbnNlICYmXG4gICAgICAgIHR5cGVvZiByZXNwb25zZSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgIXJlcXVlc3Qub2JqZWN0LmVxdWFscyhyZXNwb25zZSkgJiZcbiAgICAgICAgcmVxdWVzdC50cmlnZ2VyTmFtZSA9PT0gVHlwZXMuYmVmb3JlU2F2ZVxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNwb25zZSAmJiB0eXBlb2YgcmVzcG9uc2UgPT09ICdvYmplY3QnICYmIHJlcXVlc3QudHJpZ2dlck5hbWUgPT09IFR5cGVzLmFmdGVyU2F2ZSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXNwb25zZSk7XG4gICAgICB9XG4gICAgICBpZiAocmVxdWVzdC50cmlnZ2VyTmFtZSA9PT0gVHlwZXMuYWZ0ZXJTYXZlKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICB9XG4gICAgICByZXNwb25zZSA9IHt9O1xuICAgICAgaWYgKHJlcXVlc3QudHJpZ2dlck5hbWUgPT09IFR5cGVzLmJlZm9yZVNhdmUpIHtcbiAgICAgICAgcmVzcG9uc2VbJ29iamVjdCddID0gcmVxdWVzdC5vYmplY3QuX2dldFNhdmVKU09OKCk7XG4gICAgICAgIHJlc3BvbnNlWydvYmplY3QnXVsnb2JqZWN0SWQnXSA9IHJlcXVlc3Qub2JqZWN0LmlkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc29sdmUocmVzcG9uc2UpO1xuICAgIH0sXG4gICAgZXJyb3I6IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgY29uc3QgZSA9IHJlc29sdmVFcnJvcihlcnJvciwge1xuICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5TQ1JJUFRfRkFJTEVELFxuICAgICAgICBtZXNzYWdlOiAnU2NyaXB0IGZhaWxlZC4gVW5rbm93biBlcnJvci4nLFxuICAgICAgfSk7XG4gICAgICByZWplY3QoZSk7XG4gICAgfSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlcklkRm9yTG9nKGF1dGgpIHtcbiAgcmV0dXJuIGF1dGggJiYgYXV0aC51c2VyID8gYXV0aC51c2VyLmlkIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBsb2dUcmlnZ2VyQWZ0ZXJIb29rKHRyaWdnZXJUeXBlLCBjbGFzc05hbWUsIGlucHV0LCBhdXRoLCBsb2dMZXZlbCkge1xuICBjb25zdCBjbGVhbklucHV0ID0gbG9nZ2VyLnRydW5jYXRlTG9nTWVzc2FnZShKU09OLnN0cmluZ2lmeShpbnB1dCkpO1xuICBsb2dnZXJbbG9nTGV2ZWxdKFxuICAgIGAke3RyaWdnZXJUeXBlfSB0cmlnZ2VyZWQgZm9yICR7Y2xhc3NOYW1lfSBmb3IgdXNlciAke3VzZXJJZEZvckxvZyhcbiAgICAgIGF1dGhcbiAgICApfTpcXG4gIElucHV0OiAke2NsZWFuSW5wdXR9YCxcbiAgICB7XG4gICAgICBjbGFzc05hbWUsXG4gICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgIHVzZXI6IHVzZXJJZEZvckxvZyhhdXRoKSxcbiAgICB9XG4gICk7XG59XG5cbmZ1bmN0aW9uIGxvZ1RyaWdnZXJTdWNjZXNzQmVmb3JlSG9vayh0cmlnZ2VyVHlwZSwgY2xhc3NOYW1lLCBpbnB1dCwgcmVzdWx0LCBhdXRoLCBsb2dMZXZlbCkge1xuICBjb25zdCBjbGVhbklucHV0ID0gbG9nZ2VyLnRydW5jYXRlTG9nTWVzc2FnZShKU09OLnN0cmluZ2lmeShpbnB1dCkpO1xuICBjb25zdCBjbGVhblJlc3VsdCA9IGxvZ2dlci50cnVuY2F0ZUxvZ01lc3NhZ2UoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7XG4gIGxvZ2dlcltsb2dMZXZlbF0oXG4gICAgYCR7dHJpZ2dlclR5cGV9IHRyaWdnZXJlZCBmb3IgJHtjbGFzc05hbWV9IGZvciB1c2VyICR7dXNlcklkRm9yTG9nKFxuICAgICAgYXV0aFxuICAgICl9OlxcbiAgSW5wdXQ6ICR7Y2xlYW5JbnB1dH1cXG4gIFJlc3VsdDogJHtjbGVhblJlc3VsdH1gLFxuICAgIHtcbiAgICAgIGNsYXNzTmFtZSxcbiAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgdXNlcjogdXNlcklkRm9yTG9nKGF1dGgpLFxuICAgIH1cbiAgKTtcbn1cblxuZnVuY3Rpb24gbG9nVHJpZ2dlckVycm9yQmVmb3JlSG9vayh0cmlnZ2VyVHlwZSwgY2xhc3NOYW1lLCBpbnB1dCwgYXV0aCwgZXJyb3IsIGxvZ0xldmVsKSB7XG4gIGNvbnN0IGNsZWFuSW5wdXQgPSBsb2dnZXIudHJ1bmNhdGVMb2dNZXNzYWdlKEpTT04uc3RyaW5naWZ5KGlucHV0KSk7XG4gIGxvZ2dlcltsb2dMZXZlbF0oXG4gICAgYCR7dHJpZ2dlclR5cGV9IGZhaWxlZCBmb3IgJHtjbGFzc05hbWV9IGZvciB1c2VyICR7dXNlcklkRm9yTG9nKFxuICAgICAgYXV0aFxuICAgICl9OlxcbiAgSW5wdXQ6ICR7Y2xlYW5JbnB1dH1cXG4gIEVycm9yOiAke0pTT04uc3RyaW5naWZ5KGVycm9yKX1gLFxuICAgIHtcbiAgICAgIGNsYXNzTmFtZSxcbiAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgZXJyb3IsXG4gICAgICB1c2VyOiB1c2VySWRGb3JMb2coYXV0aCksXG4gICAgfVxuICApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVSdW5BZnRlckZpbmRUcmlnZ2VyKFxuICB0cmlnZ2VyVHlwZSxcbiAgYXV0aCxcbiAgY2xhc3NOYW1lLFxuICBvYmplY3RzLFxuICBjb25maWcsXG4gIHF1ZXJ5LFxuICBjb250ZXh0XG4pIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjb25zdCB0cmlnZ2VyID0gZ2V0VHJpZ2dlcihjbGFzc05hbWUsIHRyaWdnZXJUeXBlLCBjb25maWcuYXBwbGljYXRpb25JZCk7XG4gICAgaWYgKCF0cmlnZ2VyKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAgIH1cbiAgICBjb25zdCByZXF1ZXN0ID0gZ2V0UmVxdWVzdE9iamVjdCh0cmlnZ2VyVHlwZSwgYXV0aCwgbnVsbCwgbnVsbCwgY29uZmlnLCBjb250ZXh0KTtcbiAgICBpZiAocXVlcnkpIHtcbiAgICAgIHJlcXVlc3QucXVlcnkgPSBxdWVyeTtcbiAgICB9XG4gICAgY29uc3QgeyBzdWNjZXNzLCBlcnJvciB9ID0gZ2V0UmVzcG9uc2VPYmplY3QoXG4gICAgICByZXF1ZXN0LFxuICAgICAgb2JqZWN0ID0+IHtcbiAgICAgICAgcmVzb2x2ZShvYmplY3QpO1xuICAgICAgfSxcbiAgICAgIGVycm9yID0+IHtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICApO1xuICAgIGxvZ1RyaWdnZXJTdWNjZXNzQmVmb3JlSG9vayhcbiAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgY2xhc3NOYW1lLFxuICAgICAgJ0FmdGVyRmluZCcsXG4gICAgICBKU09OLnN0cmluZ2lmeShvYmplY3RzKSxcbiAgICAgIGF1dGgsXG4gICAgICBjb25maWcubG9nTGV2ZWxzLnRyaWdnZXJCZWZvcmVTdWNjZXNzXG4gICAgKTtcbiAgICByZXF1ZXN0Lm9iamVjdHMgPSBvYmplY3RzLm1hcChvYmplY3QgPT4ge1xuICAgICAgLy9zZXR0aW5nIHRoZSBjbGFzcyBuYW1lIHRvIHRyYW5zZm9ybSBpbnRvIHBhcnNlIG9iamVjdFxuICAgICAgb2JqZWN0LmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcbiAgICAgIHJldHVybiBQYXJzZS5PYmplY3QuZnJvbUpTT04ob2JqZWN0KTtcbiAgICB9KTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIG1heWJlUnVuVmFsaWRhdG9yKHJlcXVlc3QsIGAke3RyaWdnZXJUeXBlfS4ke2NsYXNzTmFtZX1gLCBhdXRoKTtcbiAgICAgIH0pXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIGlmIChyZXF1ZXN0LnNraXBXaXRoTWFzdGVyS2V5KSB7XG4gICAgICAgICAgcmV0dXJuIHJlcXVlc3Qub2JqZWN0cztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNwb25zZSA9IHRyaWdnZXIocmVxdWVzdCk7XG4gICAgICAgIGlmIChyZXNwb25zZSAmJiB0eXBlb2YgcmVzcG9uc2UudGhlbiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHJldHVybiByZXNwb25zZS50aGVuKHJlc3VsdHMgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHN1Y2Nlc3MsIGVycm9yKTtcbiAgfSkudGhlbihyZXN1bHRzID0+IHtcbiAgICBsb2dUcmlnZ2VyQWZ0ZXJIb29rKFxuICAgICAgdHJpZ2dlclR5cGUsXG4gICAgICBjbGFzc05hbWUsXG4gICAgICBKU09OLnN0cmluZ2lmeShyZXN1bHRzKSxcbiAgICAgIGF1dGgsXG4gICAgICBjb25maWcubG9nTGV2ZWxzLnRyaWdnZXJBZnRlclxuICAgICk7XG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWF5YmVSdW5RdWVyeVRyaWdnZXIoXG4gIHRyaWdnZXJUeXBlLFxuICBjbGFzc05hbWUsXG4gIHJlc3RXaGVyZSxcbiAgcmVzdE9wdGlvbnMsXG4gIGNvbmZpZyxcbiAgYXV0aCxcbiAgY29udGV4dCxcbiAgaXNHZXRcbikge1xuICBjb25zdCB0cmlnZ2VyID0gZ2V0VHJpZ2dlcihjbGFzc05hbWUsIHRyaWdnZXJUeXBlLCBjb25maWcuYXBwbGljYXRpb25JZCk7XG4gIGlmICghdHJpZ2dlcikge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoe1xuICAgICAgcmVzdFdoZXJlLFxuICAgICAgcmVzdE9wdGlvbnMsXG4gICAgfSk7XG4gIH1cbiAgY29uc3QganNvbiA9IE9iamVjdC5hc3NpZ24oe30sIHJlc3RPcHRpb25zKTtcbiAganNvbi53aGVyZSA9IHJlc3RXaGVyZTtcblxuICBjb25zdCBwYXJzZVF1ZXJ5ID0gbmV3IFBhcnNlLlF1ZXJ5KGNsYXNzTmFtZSk7XG4gIHBhcnNlUXVlcnkud2l0aEpTT04oanNvbik7XG5cbiAgbGV0IGNvdW50ID0gZmFsc2U7XG4gIGlmIChyZXN0T3B0aW9ucykge1xuICAgIGNvdW50ID0gISFyZXN0T3B0aW9ucy5jb3VudDtcbiAgfVxuICBjb25zdCByZXF1ZXN0T2JqZWN0ID0gZ2V0UmVxdWVzdFF1ZXJ5T2JqZWN0KFxuICAgIHRyaWdnZXJUeXBlLFxuICAgIGF1dGgsXG4gICAgcGFyc2VRdWVyeSxcbiAgICBjb3VudCxcbiAgICBjb25maWcsXG4gICAgY29udGV4dCxcbiAgICBpc0dldFxuICApO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICByZXR1cm4gbWF5YmVSdW5WYWxpZGF0b3IocmVxdWVzdE9iamVjdCwgYCR7dHJpZ2dlclR5cGV9LiR7Y2xhc3NOYW1lfWAsIGF1dGgpO1xuICAgIH0pXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgaWYgKHJlcXVlc3RPYmplY3Quc2tpcFdpdGhNYXN0ZXJLZXkpIHtcbiAgICAgICAgcmV0dXJuIHJlcXVlc3RPYmplY3QucXVlcnk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdHJpZ2dlcihyZXF1ZXN0T2JqZWN0KTtcbiAgICB9KVxuICAgIC50aGVuKFxuICAgICAgcmVzdWx0ID0+IHtcbiAgICAgICAgbGV0IHF1ZXJ5UmVzdWx0ID0gcGFyc2VRdWVyeTtcbiAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQgaW5zdGFuY2VvZiBQYXJzZS5RdWVyeSkge1xuICAgICAgICAgIHF1ZXJ5UmVzdWx0ID0gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGpzb25RdWVyeSA9IHF1ZXJ5UmVzdWx0LnRvSlNPTigpO1xuICAgICAgICBpZiAoanNvblF1ZXJ5LndoZXJlKSB7XG4gICAgICAgICAgcmVzdFdoZXJlID0ganNvblF1ZXJ5LndoZXJlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkubGltaXQpIHtcbiAgICAgICAgICByZXN0T3B0aW9ucyA9IHJlc3RPcHRpb25zIHx8IHt9O1xuICAgICAgICAgIHJlc3RPcHRpb25zLmxpbWl0ID0ganNvblF1ZXJ5LmxpbWl0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuc2tpcCkge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuc2tpcCA9IGpzb25RdWVyeS5za2lwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuaW5jbHVkZSkge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuaW5jbHVkZSA9IGpzb25RdWVyeS5pbmNsdWRlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuZXhjbHVkZUtleXMpIHtcbiAgICAgICAgICByZXN0T3B0aW9ucyA9IHJlc3RPcHRpb25zIHx8IHt9O1xuICAgICAgICAgIHJlc3RPcHRpb25zLmV4Y2x1ZGVLZXlzID0ganNvblF1ZXJ5LmV4Y2x1ZGVLZXlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuZXhwbGFpbikge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuZXhwbGFpbiA9IGpzb25RdWVyeS5leHBsYWluO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkua2V5cykge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMua2V5cyA9IGpzb25RdWVyeS5rZXlzO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkub3JkZXIpIHtcbiAgICAgICAgICByZXN0T3B0aW9ucyA9IHJlc3RPcHRpb25zIHx8IHt9O1xuICAgICAgICAgIHJlc3RPcHRpb25zLm9yZGVyID0ganNvblF1ZXJ5Lm9yZGVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChqc29uUXVlcnkuaGludCkge1xuICAgICAgICAgIHJlc3RPcHRpb25zID0gcmVzdE9wdGlvbnMgfHwge307XG4gICAgICAgICAgcmVzdE9wdGlvbnMuaGludCA9IGpzb25RdWVyeS5oaW50O1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXF1ZXN0T2JqZWN0LnJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcmVzdE9wdGlvbnMgPSByZXN0T3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICByZXN0T3B0aW9ucy5yZWFkUHJlZmVyZW5jZSA9IHJlcXVlc3RPYmplY3QucmVhZFByZWZlcmVuY2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlcXVlc3RPYmplY3QuaW5jbHVkZVJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcmVzdE9wdGlvbnMgPSByZXN0T3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICByZXN0T3B0aW9ucy5pbmNsdWRlUmVhZFByZWZlcmVuY2UgPSByZXF1ZXN0T2JqZWN0LmluY2x1ZGVSZWFkUHJlZmVyZW5jZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVxdWVzdE9iamVjdC5zdWJxdWVyeVJlYWRQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgcmVzdE9wdGlvbnMgPSByZXN0T3B0aW9ucyB8fCB7fTtcbiAgICAgICAgICByZXN0T3B0aW9ucy5zdWJxdWVyeVJlYWRQcmVmZXJlbmNlID0gcmVxdWVzdE9iamVjdC5zdWJxdWVyeVJlYWRQcmVmZXJlbmNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgcmVzdFdoZXJlLFxuICAgICAgICAgIHJlc3RPcHRpb25zLFxuICAgICAgICB9O1xuICAgICAgfSxcbiAgICAgIGVyciA9PiB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gcmVzb2x2ZUVycm9yKGVyciwge1xuICAgICAgICAgIGNvZGU6IFBhcnNlLkVycm9yLlNDUklQVF9GQUlMRUQsXG4gICAgICAgICAgbWVzc2FnZTogJ1NjcmlwdCBmYWlsZWQuIFVua25vd24gZXJyb3IuJyxcbiAgICAgICAgfSk7XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgICk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlRXJyb3IobWVzc2FnZSwgZGVmYXVsdE9wdHMpIHtcbiAgaWYgKCFkZWZhdWx0T3B0cykge1xuICAgIGRlZmF1bHRPcHRzID0ge307XG4gIH1cbiAgaWYgKCFtZXNzYWdlKSB7XG4gICAgcmV0dXJuIG5ldyBQYXJzZS5FcnJvcihcbiAgICAgIGRlZmF1bHRPcHRzLmNvZGUgfHwgUGFyc2UuRXJyb3IuU0NSSVBUX0ZBSUxFRCxcbiAgICAgIGRlZmF1bHRPcHRzLm1lc3NhZ2UgfHwgJ1NjcmlwdCBmYWlsZWQuJ1xuICAgICk7XG4gIH1cbiAgaWYgKG1lc3NhZ2UgaW5zdGFuY2VvZiBQYXJzZS5FcnJvcikge1xuICAgIHJldHVybiBtZXNzYWdlO1xuICB9XG5cbiAgY29uc3QgY29kZSA9IGRlZmF1bHRPcHRzLmNvZGUgfHwgUGFyc2UuRXJyb3IuU0NSSVBUX0ZBSUxFRDtcbiAgLy8gSWYgaXQncyBhbiBlcnJvciwgbWFyayBpdCBhcyBhIHNjcmlwdCBmYWlsZWRcbiAgaWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBuZXcgUGFyc2UuRXJyb3IoY29kZSwgbWVzc2FnZSk7XG4gIH1cbiAgY29uc3QgZXJyb3IgPSBuZXcgUGFyc2UuRXJyb3IoY29kZSwgbWVzc2FnZS5tZXNzYWdlIHx8IG1lc3NhZ2UpO1xuICBpZiAobWVzc2FnZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgZXJyb3Iuc3RhY2sgPSBtZXNzYWdlLnN0YWNrO1xuICB9XG4gIHJldHVybiBlcnJvcjtcbn1cbmV4cG9ydCBmdW5jdGlvbiBtYXliZVJ1blZhbGlkYXRvcihyZXF1ZXN0LCBmdW5jdGlvbk5hbWUsIGF1dGgpIHtcbiAgY29uc3QgdGhlVmFsaWRhdG9yID0gZ2V0VmFsaWRhdG9yKGZ1bmN0aW9uTmFtZSwgUGFyc2UuYXBwbGljYXRpb25JZCk7XG4gIGlmICghdGhlVmFsaWRhdG9yKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICh0eXBlb2YgdGhlVmFsaWRhdG9yID09PSAnb2JqZWN0JyAmJiB0aGVWYWxpZGF0b3Iuc2tpcFdpdGhNYXN0ZXJLZXkgJiYgcmVxdWVzdC5tYXN0ZXIpIHtcbiAgICByZXF1ZXN0LnNraXBXaXRoTWFzdGVyS2V5ID0gdHJ1ZTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdHlwZW9mIHRoZVZhbGlkYXRvciA9PT0gJ29iamVjdCdcbiAgICAgICAgICA/IGJ1aWx0SW5UcmlnZ2VyVmFsaWRhdG9yKHRoZVZhbGlkYXRvciwgcmVxdWVzdCwgYXV0aClcbiAgICAgICAgICA6IHRoZVZhbGlkYXRvcihyZXF1ZXN0KTtcbiAgICAgIH0pXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goZSA9PiB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gcmVzb2x2ZUVycm9yKGUsIHtcbiAgICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5WQUxJREFUSU9OX0VSUk9SLFxuICAgICAgICAgIG1lc3NhZ2U6ICdWYWxpZGF0aW9uIGZhaWxlZC4nLFxuICAgICAgICB9KTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH0pO1xuICB9KTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGJ1aWx0SW5UcmlnZ2VyVmFsaWRhdG9yKG9wdGlvbnMsIHJlcXVlc3QsIGF1dGgpIHtcbiAgaWYgKHJlcXVlc3QubWFzdGVyICYmICFvcHRpb25zLnZhbGlkYXRlTWFzdGVyS2V5KSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxldCByZXFVc2VyID0gcmVxdWVzdC51c2VyO1xuICBpZiAoXG4gICAgIXJlcVVzZXIgJiZcbiAgICByZXF1ZXN0Lm9iamVjdCAmJlxuICAgIHJlcXVlc3Qub2JqZWN0LmNsYXNzTmFtZSA9PT0gJ19Vc2VyJyAmJlxuICAgICFyZXF1ZXN0Lm9iamVjdC5leGlzdGVkKClcbiAgKSB7XG4gICAgcmVxVXNlciA9IHJlcXVlc3Qub2JqZWN0O1xuICB9XG4gIGlmIChcbiAgICAob3B0aW9ucy5yZXF1aXJlVXNlciB8fCBvcHRpb25zLnJlcXVpcmVBbnlVc2VyUm9sZXMgfHwgb3B0aW9ucy5yZXF1aXJlQWxsVXNlclJvbGVzKSAmJlxuICAgICFyZXFVc2VyXG4gICkge1xuICAgIHRocm93ICdWYWxpZGF0aW9uIGZhaWxlZC4gUGxlYXNlIGxvZ2luIHRvIGNvbnRpbnVlLic7XG4gIH1cbiAgaWYgKG9wdGlvbnMucmVxdWlyZU1hc3RlciAmJiAhcmVxdWVzdC5tYXN0ZXIpIHtcbiAgICB0aHJvdyAnVmFsaWRhdGlvbiBmYWlsZWQuIE1hc3RlciBrZXkgaXMgcmVxdWlyZWQgdG8gY29tcGxldGUgdGhpcyByZXF1ZXN0Lic7XG4gIH1cbiAgbGV0IHBhcmFtcyA9IHJlcXVlc3QucGFyYW1zIHx8IHt9O1xuICBpZiAocmVxdWVzdC5vYmplY3QpIHtcbiAgICBwYXJhbXMgPSByZXF1ZXN0Lm9iamVjdC50b0pTT04oKTtcbiAgfVxuICBjb25zdCByZXF1aXJlZFBhcmFtID0ga2V5ID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IHBhcmFtc1trZXldO1xuICAgIGlmICh2YWx1ZSA9PSBudWxsKSB7XG4gICAgICB0aHJvdyBgVmFsaWRhdGlvbiBmYWlsZWQuIFBsZWFzZSBzcGVjaWZ5IGRhdGEgZm9yICR7a2V5fS5gO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCB2YWxpZGF0ZU9wdGlvbnMgPSBhc3luYyAob3B0LCBrZXksIHZhbCkgPT4ge1xuICAgIGxldCBvcHRzID0gb3B0Lm9wdGlvbnM7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBvcHRzKHZhbCk7XG4gICAgICAgIGlmICghcmVzdWx0ICYmIHJlc3VsdCAhPSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgb3B0LmVycm9yIHx8IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCB2YWx1ZSBmb3IgJHtrZXl9LmA7XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgaWYgKCFlKSB7XG4gICAgICAgICAgdGhyb3cgb3B0LmVycm9yIHx8IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCB2YWx1ZSBmb3IgJHtrZXl9LmA7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBvcHQuZXJyb3IgfHwgZS5tZXNzYWdlIHx8IGU7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvcHRzKSkge1xuICAgICAgb3B0cyA9IFtvcHQub3B0aW9uc107XG4gICAgfVxuXG4gICAgaWYgKCFvcHRzLmluY2x1ZGVzKHZhbCkpIHtcbiAgICAgIHRocm93IChcbiAgICAgICAgb3B0LmVycm9yIHx8IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCBvcHRpb24gZm9yICR7a2V5fS4gRXhwZWN0ZWQ6ICR7b3B0cy5qb2luKCcsICcpfWBcbiAgICAgICk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGdldFR5cGUgPSBmbiA9PiB7XG4gICAgY29uc3QgbWF0Y2ggPSBmbiAmJiBmbi50b1N0cmluZygpLm1hdGNoKC9eXFxzKmZ1bmN0aW9uIChcXHcrKS8pO1xuICAgIHJldHVybiAobWF0Y2ggPyBtYXRjaFsxXSA6ICcnKS50b0xvd2VyQ2FzZSgpO1xuICB9O1xuICBpZiAoQXJyYXkuaXNBcnJheShvcHRpb25zLmZpZWxkcykpIHtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBvcHRpb25zLmZpZWxkcykge1xuICAgICAgcmVxdWlyZWRQYXJhbShrZXkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBvcHRpb25Qcm9taXNlcyA9IFtdO1xuICAgIGZvciAoY29uc3Qga2V5IGluIG9wdGlvbnMuZmllbGRzKSB7XG4gICAgICBjb25zdCBvcHQgPSBvcHRpb25zLmZpZWxkc1trZXldO1xuICAgICAgbGV0IHZhbCA9IHBhcmFtc1trZXldO1xuICAgICAgaWYgKHR5cGVvZiBvcHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJlcXVpcmVkUGFyYW0ob3B0KTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb3B0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAob3B0LmRlZmF1bHQgIT0gbnVsbCAmJiB2YWwgPT0gbnVsbCkge1xuICAgICAgICAgIHZhbCA9IG9wdC5kZWZhdWx0O1xuICAgICAgICAgIHBhcmFtc1trZXldID0gdmFsO1xuICAgICAgICAgIGlmIChyZXF1ZXN0Lm9iamVjdCkge1xuICAgICAgICAgICAgcmVxdWVzdC5vYmplY3Quc2V0KGtleSwgdmFsKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdC5jb25zdGFudCAmJiByZXF1ZXN0Lm9iamVjdCkge1xuICAgICAgICAgIGlmIChyZXF1ZXN0Lm9yaWdpbmFsKSB7XG4gICAgICAgICAgICByZXF1ZXN0Lm9iamVjdC5yZXZlcnQoa2V5KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG9wdC5kZWZhdWx0ICE9IG51bGwpIHtcbiAgICAgICAgICAgIHJlcXVlc3Qub2JqZWN0LnNldChrZXksIG9wdC5kZWZhdWx0KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdC5yZXF1aXJlZCkge1xuICAgICAgICAgIHJlcXVpcmVkUGFyYW0oa2V5KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvcHRpb25hbCA9ICFvcHQucmVxdWlyZWQgJiYgdmFsID09PSB1bmRlZmluZWQ7XG4gICAgICAgIGlmICghb3B0aW9uYWwpIHtcbiAgICAgICAgICBpZiAob3B0LnR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBnZXRUeXBlKG9wdC50eXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHZhbFR5cGUgPSBBcnJheS5pc0FycmF5KHZhbCkgPyAnYXJyYXknIDogdHlwZW9mIHZhbDtcbiAgICAgICAgICAgIGlmICh2YWxUeXBlICE9PSB0eXBlKSB7XG4gICAgICAgICAgICAgIHRocm93IGBWYWxpZGF0aW9uIGZhaWxlZC4gSW52YWxpZCB0eXBlIGZvciAke2tleX0uIEV4cGVjdGVkOiAke3R5cGV9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG9wdC5vcHRpb25zKSB7XG4gICAgICAgICAgICBvcHRpb25Qcm9taXNlcy5wdXNoKHZhbGlkYXRlT3B0aW9ucyhvcHQsIGtleSwgdmFsKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGF3YWl0IFByb21pc2UuYWxsKG9wdGlvblByb21pc2VzKTtcbiAgfVxuICBsZXQgdXNlclJvbGVzID0gb3B0aW9ucy5yZXF1aXJlQW55VXNlclJvbGVzO1xuICBsZXQgcmVxdWlyZUFsbFJvbGVzID0gb3B0aW9ucy5yZXF1aXJlQWxsVXNlclJvbGVzO1xuICBjb25zdCBwcm9taXNlcyA9IFtQcm9taXNlLnJlc29sdmUoKSwgUHJvbWlzZS5yZXNvbHZlKCksIFByb21pc2UucmVzb2x2ZSgpXTtcbiAgaWYgKHVzZXJSb2xlcyB8fCByZXF1aXJlQWxsUm9sZXMpIHtcbiAgICBwcm9taXNlc1swXSA9IGF1dGguZ2V0VXNlclJvbGVzKCk7XG4gIH1cbiAgaWYgKHR5cGVvZiB1c2VyUm9sZXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICBwcm9taXNlc1sxXSA9IHVzZXJSb2xlcygpO1xuICB9XG4gIGlmICh0eXBlb2YgcmVxdWlyZUFsbFJvbGVzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcHJvbWlzZXNbMl0gPSByZXF1aXJlQWxsUm9sZXMoKTtcbiAgfVxuICBjb25zdCBbcm9sZXMsIHJlc29sdmVkVXNlclJvbGVzLCByZXNvbHZlZFJlcXVpcmVBbGxdID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICBpZiAocmVzb2x2ZWRVc2VyUm9sZXMgJiYgQXJyYXkuaXNBcnJheShyZXNvbHZlZFVzZXJSb2xlcykpIHtcbiAgICB1c2VyUm9sZXMgPSByZXNvbHZlZFVzZXJSb2xlcztcbiAgfVxuICBpZiAocmVzb2x2ZWRSZXF1aXJlQWxsICYmIEFycmF5LmlzQXJyYXkocmVzb2x2ZWRSZXF1aXJlQWxsKSkge1xuICAgIHJlcXVpcmVBbGxSb2xlcyA9IHJlc29sdmVkUmVxdWlyZUFsbDtcbiAgfVxuICBpZiAodXNlclJvbGVzKSB7XG4gICAgY29uc3QgaGFzUm9sZSA9IHVzZXJSb2xlcy5zb21lKHJlcXVpcmVkUm9sZSA9PiByb2xlcy5pbmNsdWRlcyhgcm9sZToke3JlcXVpcmVkUm9sZX1gKSk7XG4gICAgaWYgKCFoYXNSb2xlKSB7XG4gICAgICB0aHJvdyBgVmFsaWRhdGlvbiBmYWlsZWQuIFVzZXIgZG9lcyBub3QgbWF0Y2ggdGhlIHJlcXVpcmVkIHJvbGVzLmA7XG4gICAgfVxuICB9XG4gIGlmIChyZXF1aXJlQWxsUm9sZXMpIHtcbiAgICBmb3IgKGNvbnN0IHJlcXVpcmVkUm9sZSBvZiByZXF1aXJlQWxsUm9sZXMpIHtcbiAgICAgIGlmICghcm9sZXMuaW5jbHVkZXMoYHJvbGU6JHtyZXF1aXJlZFJvbGV9YCkpIHtcbiAgICAgICAgdGhyb3cgYFZhbGlkYXRpb24gZmFpbGVkLiBVc2VyIGRvZXMgbm90IG1hdGNoIGFsbCB0aGUgcmVxdWlyZWQgcm9sZXMuYDtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgY29uc3QgdXNlcktleXMgPSBvcHRpb25zLnJlcXVpcmVVc2VyS2V5cyB8fCBbXTtcbiAgaWYgKEFycmF5LmlzQXJyYXkodXNlcktleXMpKSB7XG4gICAgZm9yIChjb25zdCBrZXkgb2YgdXNlcktleXMpIHtcbiAgICAgIGlmICghcmVxVXNlcikge1xuICAgICAgICB0aHJvdyAnUGxlYXNlIGxvZ2luIHRvIG1ha2UgdGhpcyByZXF1ZXN0Lic7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXFVc2VyLmdldChrZXkpID09IG51bGwpIHtcbiAgICAgICAgdGhyb3cgYFZhbGlkYXRpb24gZmFpbGVkLiBQbGVhc2Ugc2V0IGRhdGEgZm9yICR7a2V5fSBvbiB5b3VyIGFjY291bnQuYDtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHVzZXJLZXlzID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IG9wdGlvblByb21pc2VzID0gW107XG4gICAgZm9yIChjb25zdCBrZXkgaW4gb3B0aW9ucy5yZXF1aXJlVXNlcktleXMpIHtcbiAgICAgIGNvbnN0IG9wdCA9IG9wdGlvbnMucmVxdWlyZVVzZXJLZXlzW2tleV07XG4gICAgICBpZiAob3B0Lm9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9uUHJvbWlzZXMucHVzaCh2YWxpZGF0ZU9wdGlvbnMob3B0LCBrZXksIHJlcVVzZXIuZ2V0KGtleSkpKTtcbiAgICAgIH1cbiAgICB9XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwob3B0aW9uUHJvbWlzZXMpO1xuICB9XG59XG5cbi8vIFRvIGJlIHVzZWQgYXMgcGFydCBvZiB0aGUgcHJvbWlzZSBjaGFpbiB3aGVuIHNhdmluZy9kZWxldGluZyBhbiBvYmplY3Rcbi8vIFdpbGwgcmVzb2x2ZSBzdWNjZXNzZnVsbHkgaWYgbm8gdHJpZ2dlciBpcyBjb25maWd1cmVkXG4vLyBSZXNvbHZlcyB0byBhbiBvYmplY3QsIGVtcHR5IG9yIGNvbnRhaW5pbmcgYW4gb2JqZWN0IGtleS4gQSBiZWZvcmVTYXZlXG4vLyB0cmlnZ2VyIHdpbGwgc2V0IHRoZSBvYmplY3Qga2V5IHRvIHRoZSByZXN0IGZvcm1hdCBvYmplY3QgdG8gc2F2ZS5cbi8vIG9yaWdpbmFsUGFyc2VPYmplY3QgaXMgb3B0aW9uYWwsIHdlIG9ubHkgbmVlZCB0aGF0IGZvciBiZWZvcmUvYWZ0ZXJTYXZlIGZ1bmN0aW9uc1xuZXhwb3J0IGZ1bmN0aW9uIG1heWJlUnVuVHJpZ2dlcihcbiAgdHJpZ2dlclR5cGUsXG4gIGF1dGgsXG4gIHBhcnNlT2JqZWN0LFxuICBvcmlnaW5hbFBhcnNlT2JqZWN0LFxuICBjb25maWcsXG4gIGNvbnRleHRcbikge1xuICBpZiAoIXBhcnNlT2JqZWN0KSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh7fSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgdHJpZ2dlciA9IGdldFRyaWdnZXIocGFyc2VPYmplY3QuY2xhc3NOYW1lLCB0cmlnZ2VyVHlwZSwgY29uZmlnLmFwcGxpY2F0aW9uSWQpO1xuICAgIGlmICghdHJpZ2dlcikgcmV0dXJuIHJlc29sdmUoKTtcbiAgICB2YXIgcmVxdWVzdCA9IGdldFJlcXVlc3RPYmplY3QoXG4gICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgIGF1dGgsXG4gICAgICBwYXJzZU9iamVjdCxcbiAgICAgIG9yaWdpbmFsUGFyc2VPYmplY3QsXG4gICAgICBjb25maWcsXG4gICAgICBjb250ZXh0XG4gICAgKTtcbiAgICB2YXIgeyBzdWNjZXNzLCBlcnJvciB9ID0gZ2V0UmVzcG9uc2VPYmplY3QoXG4gICAgICByZXF1ZXN0LFxuICAgICAgb2JqZWN0ID0+IHtcbiAgICAgICAgbG9nVHJpZ2dlclN1Y2Nlc3NCZWZvcmVIb29rKFxuICAgICAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgICAgIHBhcnNlT2JqZWN0LmNsYXNzTmFtZSxcbiAgICAgICAgICBwYXJzZU9iamVjdC50b0pTT04oKSxcbiAgICAgICAgICBvYmplY3QsXG4gICAgICAgICAgYXV0aCxcbiAgICAgICAgICB0cmlnZ2VyVHlwZS5zdGFydHNXaXRoKCdhZnRlcicpXG4gICAgICAgICAgICA/IGNvbmZpZy5sb2dMZXZlbHMudHJpZ2dlckFmdGVyXG4gICAgICAgICAgICA6IGNvbmZpZy5sb2dMZXZlbHMudHJpZ2dlckJlZm9yZVN1Y2Nlc3NcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5iZWZvcmVTYXZlIHx8XG4gICAgICAgICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyU2F2ZSB8fFxuICAgICAgICAgIHRyaWdnZXJUeXBlID09PSBUeXBlcy5iZWZvcmVEZWxldGUgfHxcbiAgICAgICAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJEZWxldGVcbiAgICAgICAgKSB7XG4gICAgICAgICAgT2JqZWN0LmFzc2lnbihjb250ZXh0LCByZXF1ZXN0LmNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIHJlc29sdmUob2JqZWN0KTtcbiAgICAgIH0sXG4gICAgICBlcnJvciA9PiB7XG4gICAgICAgIGxvZ1RyaWdnZXJFcnJvckJlZm9yZUhvb2soXG4gICAgICAgICAgdHJpZ2dlclR5cGUsXG4gICAgICAgICAgcGFyc2VPYmplY3QuY2xhc3NOYW1lLFxuICAgICAgICAgIHBhcnNlT2JqZWN0LnRvSlNPTigpLFxuICAgICAgICAgIGF1dGgsXG4gICAgICAgICAgZXJyb3IsXG4gICAgICAgICAgY29uZmlnLmxvZ0xldmVscy50cmlnZ2VyQmVmb3JlRXJyb3JcbiAgICAgICAgKTtcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQWZ0ZXJTYXZlIGFuZCBhZnRlckRlbGV0ZSB0cmlnZ2VycyBjYW4gcmV0dXJuIGEgcHJvbWlzZSwgd2hpY2ggaWYgdGhleVxuICAgIC8vIGRvLCBuZWVkcyB0byBiZSByZXNvbHZlZCBiZWZvcmUgdGhpcyBwcm9taXNlIGlzIHJlc29sdmVkLFxuICAgIC8vIHNvIHRyaWdnZXIgZXhlY3V0aW9uIGlzIHN5bmNlZCB3aXRoIFJlc3RXcml0ZS5leGVjdXRlKCkgY2FsbC5cbiAgICAvLyBJZiB0cmlnZ2VycyBkbyBub3QgcmV0dXJuIGEgcHJvbWlzZSwgdGhleSBjYW4gcnVuIGFzeW5jIGNvZGUgcGFyYWxsZWxcbiAgICAvLyB0byB0aGUgUmVzdFdyaXRlLmV4ZWN1dGUoKSBjYWxsLlxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gbWF5YmVSdW5WYWxpZGF0b3IocmVxdWVzdCwgYCR7dHJpZ2dlclR5cGV9LiR7cGFyc2VPYmplY3QuY2xhc3NOYW1lfWAsIGF1dGgpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgaWYgKHJlcXVlc3Quc2tpcFdpdGhNYXN0ZXJLZXkpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcHJvbWlzZSA9IHRyaWdnZXIocmVxdWVzdCk7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYWZ0ZXJTYXZlIHx8XG4gICAgICAgICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyRGVsZXRlIHx8XG4gICAgICAgICAgdHJpZ2dlclR5cGUgPT09IFR5cGVzLmFmdGVyTG9naW5cbiAgICAgICAgKSB7XG4gICAgICAgICAgbG9nVHJpZ2dlckFmdGVySG9vayhcbiAgICAgICAgICAgIHRyaWdnZXJUeXBlLFxuICAgICAgICAgICAgcGFyc2VPYmplY3QuY2xhc3NOYW1lLFxuICAgICAgICAgICAgcGFyc2VPYmplY3QudG9KU09OKCksXG4gICAgICAgICAgICBhdXRoLFxuICAgICAgICAgICAgY29uZmlnLmxvZ0xldmVscy50cmlnZ2VyQWZ0ZXJcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGJlZm9yZVNhdmUgaXMgZXhwZWN0ZWQgdG8gcmV0dXJuIG51bGwgKG5vdGhpbmcpXG4gICAgICAgIGlmICh0cmlnZ2VyVHlwZSA9PT0gVHlwZXMuYmVmb3JlU2F2ZSkge1xuICAgICAgICAgIGlmIChwcm9taXNlICYmIHR5cGVvZiBwcm9taXNlLnRoZW4gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9taXNlLnRoZW4ocmVzcG9uc2UgPT4ge1xuICAgICAgICAgICAgICAvLyByZXNwb25zZS5vYmplY3QgbWF5IGNvbWUgZnJvbSBleHByZXNzIHJvdXRpbmcgYmVmb3JlIGhvb2tcbiAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlICYmIHJlc3BvbnNlLm9iamVjdCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXNwb25zZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHN1Y2Nlc3MsIGVycm9yKTtcbiAgfSk7XG59XG5cbi8vIENvbnZlcnRzIGEgUkVTVC1mb3JtYXQgb2JqZWN0IHRvIGEgUGFyc2UuT2JqZWN0XG4vLyBkYXRhIGlzIGVpdGhlciBjbGFzc05hbWUgb3IgYW4gb2JqZWN0XG5leHBvcnQgZnVuY3Rpb24gaW5mbGF0ZShkYXRhLCByZXN0T2JqZWN0KSB7XG4gIHZhciBjb3B5ID0gdHlwZW9mIGRhdGEgPT0gJ29iamVjdCcgPyBkYXRhIDogeyBjbGFzc05hbWU6IGRhdGEgfTtcbiAgZm9yICh2YXIga2V5IGluIHJlc3RPYmplY3QpIHtcbiAgICBjb3B5W2tleV0gPSByZXN0T2JqZWN0W2tleV07XG4gIH1cbiAgcmV0dXJuIFBhcnNlLk9iamVjdC5mcm9tSlNPTihjb3B5KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkxpdmVRdWVyeUV2ZW50SGFuZGxlcnMoZGF0YSwgYXBwbGljYXRpb25JZCA9IFBhcnNlLmFwcGxpY2F0aW9uSWQpIHtcbiAgaWYgKCFfdHJpZ2dlclN0b3JlIHx8ICFfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdIHx8ICFfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdLkxpdmVRdWVyeSkge1xuICAgIHJldHVybjtcbiAgfVxuICBfdHJpZ2dlclN0b3JlW2FwcGxpY2F0aW9uSWRdLkxpdmVRdWVyeS5mb3JFYWNoKGhhbmRsZXIgPT4gaGFuZGxlcihkYXRhKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0RmlsZU9iamVjdCh0cmlnZ2VyVHlwZSwgYXV0aCwgZmlsZU9iamVjdCwgY29uZmlnKSB7XG4gIGNvbnN0IHJlcXVlc3QgPSB7XG4gICAgLi4uZmlsZU9iamVjdCxcbiAgICB0cmlnZ2VyTmFtZTogdHJpZ2dlclR5cGUsXG4gICAgbWFzdGVyOiBmYWxzZSxcbiAgICBsb2c6IGNvbmZpZy5sb2dnZXJDb250cm9sbGVyLFxuICAgIGhlYWRlcnM6IGNvbmZpZy5oZWFkZXJzLFxuICAgIGlwOiBjb25maWcuaXAsXG4gIH07XG5cbiAgaWYgKCFhdXRoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3Q7XG4gIH1cbiAgaWYgKGF1dGguaXNNYXN0ZXIpIHtcbiAgICByZXF1ZXN0WydtYXN0ZXInXSA9IHRydWU7XG4gIH1cbiAgaWYgKGF1dGgudXNlcikge1xuICAgIHJlcXVlc3RbJ3VzZXInXSA9IGF1dGgudXNlcjtcbiAgfVxuICBpZiAoYXV0aC5pbnN0YWxsYXRpb25JZCkge1xuICAgIHJlcXVlc3RbJ2luc3RhbGxhdGlvbklkJ10gPSBhdXRoLmluc3RhbGxhdGlvbklkO1xuICB9XG4gIHJldHVybiByZXF1ZXN0O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gbWF5YmVSdW5GaWxlVHJpZ2dlcih0cmlnZ2VyVHlwZSwgZmlsZU9iamVjdCwgY29uZmlnLCBhdXRoKSB7XG4gIGNvbnN0IEZpbGVDbGFzc05hbWUgPSBnZXRDbGFzc05hbWUoUGFyc2UuRmlsZSk7XG4gIGNvbnN0IGZpbGVUcmlnZ2VyID0gZ2V0VHJpZ2dlcihGaWxlQ2xhc3NOYW1lLCB0cmlnZ2VyVHlwZSwgY29uZmlnLmFwcGxpY2F0aW9uSWQpO1xuICBpZiAodHlwZW9mIGZpbGVUcmlnZ2VyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcXVlc3QgPSBnZXRSZXF1ZXN0RmlsZU9iamVjdCh0cmlnZ2VyVHlwZSwgYXV0aCwgZmlsZU9iamVjdCwgY29uZmlnKTtcbiAgICAgIGF3YWl0IG1heWJlUnVuVmFsaWRhdG9yKHJlcXVlc3QsIGAke3RyaWdnZXJUeXBlfS4ke0ZpbGVDbGFzc05hbWV9YCwgYXV0aCk7XG4gICAgICBpZiAocmVxdWVzdC5za2lwV2l0aE1hc3RlcktleSkge1xuICAgICAgICByZXR1cm4gZmlsZU9iamVjdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZpbGVUcmlnZ2VyKHJlcXVlc3QpO1xuICAgICAgbG9nVHJpZ2dlclN1Y2Nlc3NCZWZvcmVIb29rKFxuICAgICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgICAgJ1BhcnNlLkZpbGUnLFxuICAgICAgICB7IC4uLmZpbGVPYmplY3QuZmlsZS50b0pTT04oKSwgZmlsZVNpemU6IGZpbGVPYmplY3QuZmlsZVNpemUgfSxcbiAgICAgICAgcmVzdWx0LFxuICAgICAgICBhdXRoLFxuICAgICAgICBjb25maWcubG9nTGV2ZWxzLnRyaWdnZXJCZWZvcmVTdWNjZXNzXG4gICAgICApO1xuICAgICAgcmV0dXJuIHJlc3VsdCB8fCBmaWxlT2JqZWN0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dUcmlnZ2VyRXJyb3JCZWZvcmVIb29rKFxuICAgICAgICB0cmlnZ2VyVHlwZSxcbiAgICAgICAgJ1BhcnNlLkZpbGUnLFxuICAgICAgICB7IC4uLmZpbGVPYmplY3QuZmlsZS50b0pTT04oKSwgZmlsZVNpemU6IGZpbGVPYmplY3QuZmlsZVNpemUgfSxcbiAgICAgICAgYXV0aCxcbiAgICAgICAgZXJyb3IsXG4gICAgICAgIGNvbmZpZy5sb2dMZXZlbHMudHJpZ2dlckJlZm9yZUVycm9yXG4gICAgICApO1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG4gIHJldHVybiBmaWxlT2JqZWN0O1xufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQTtBQUNBO0FBQWtDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUUzQixNQUFNQSxLQUFLLEdBQUc7RUFDbkJDLFdBQVcsRUFBRSxhQUFhO0VBQzFCQyxVQUFVLEVBQUUsWUFBWTtFQUN4QkMsV0FBVyxFQUFFLGFBQWE7RUFDMUJDLFVBQVUsRUFBRSxZQUFZO0VBQ3hCQyxTQUFTLEVBQUUsV0FBVztFQUN0QkMsWUFBWSxFQUFFLGNBQWM7RUFDNUJDLFdBQVcsRUFBRSxhQUFhO0VBQzFCQyxVQUFVLEVBQUUsWUFBWTtFQUN4QkMsU0FBUyxFQUFFLFdBQVc7RUFDdEJDLGFBQWEsRUFBRSxlQUFlO0VBQzlCQyxlQUFlLEVBQUUsaUJBQWlCO0VBQ2xDQyxVQUFVLEVBQUU7QUFDZCxDQUFDO0FBQUM7QUFFRixNQUFNQyxnQkFBZ0IsR0FBRyxVQUFVO0FBRW5DLE1BQU1DLFNBQVMsR0FBRyxZQUFZO0VBQzVCLE1BQU1DLFVBQVUsR0FBR0MsTUFBTSxDQUFDQyxJQUFJLENBQUNqQixLQUFLLENBQUMsQ0FBQ2tCLE1BQU0sQ0FBQyxVQUFVQyxJQUFJLEVBQUVDLEdBQUcsRUFBRTtJQUNoRUQsSUFBSSxDQUFDQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDZCxPQUFPRCxJQUFJO0VBQ2IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0VBQ04sTUFBTUUsU0FBUyxHQUFHLENBQUMsQ0FBQztFQUNwQixNQUFNQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO0VBQ2YsTUFBTUMsU0FBUyxHQUFHLEVBQUU7RUFDcEIsTUFBTUMsUUFBUSxHQUFHUixNQUFNLENBQUNDLElBQUksQ0FBQ2pCLEtBQUssQ0FBQyxDQUFDa0IsTUFBTSxDQUFDLFVBQVVDLElBQUksRUFBRUMsR0FBRyxFQUFFO0lBQzlERCxJQUFJLENBQUNDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNkLE9BQU9ELElBQUk7RUFDYixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7RUFFTixPQUFPSCxNQUFNLENBQUNTLE1BQU0sQ0FBQztJQUNuQkosU0FBUztJQUNUQyxJQUFJO0lBQ0pQLFVBQVU7SUFDVlMsUUFBUTtJQUNSRDtFQUNGLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFTSxTQUFTRyxZQUFZLENBQUNDLFVBQVUsRUFBRTtFQUN2QyxJQUFJQSxVQUFVLElBQUlBLFVBQVUsQ0FBQ0MsU0FBUyxFQUFFO0lBQ3RDLE9BQU9ELFVBQVUsQ0FBQ0MsU0FBUztFQUM3QjtFQUNBLElBQUlELFVBQVUsSUFBSUEsVUFBVSxDQUFDRSxJQUFJLEVBQUU7SUFDakMsT0FBT0YsVUFBVSxDQUFDRSxJQUFJLENBQUNDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDO0VBQzlDO0VBQ0EsT0FBT0gsVUFBVTtBQUNuQjtBQUVBLFNBQVNJLDRCQUE0QixDQUFDSCxTQUFTLEVBQUVJLElBQUksRUFBRTtFQUNyRCxJQUFJQSxJQUFJLElBQUloQyxLQUFLLENBQUNJLFVBQVUsSUFBSXdCLFNBQVMsS0FBSyxhQUFhLEVBQUU7SUFDM0Q7SUFDQTtJQUNBO0lBQ0EsTUFBTSwwQ0FBMEM7RUFDbEQ7RUFDQSxJQUFJLENBQUNJLElBQUksS0FBS2hDLEtBQUssQ0FBQ0MsV0FBVyxJQUFJK0IsSUFBSSxLQUFLaEMsS0FBSyxDQUFDRSxVQUFVLEtBQUswQixTQUFTLEtBQUssT0FBTyxFQUFFO0lBQ3RGO0lBQ0E7SUFDQSxNQUFNLDZFQUE2RTtFQUNyRjtFQUNBLElBQUlJLElBQUksS0FBS2hDLEtBQUssQ0FBQ0csV0FBVyxJQUFJeUIsU0FBUyxLQUFLLFVBQVUsRUFBRTtJQUMxRDtJQUNBO0lBQ0EsTUFBTSxpRUFBaUU7RUFDekU7RUFDQSxJQUFJQSxTQUFTLEtBQUssVUFBVSxJQUFJSSxJQUFJLEtBQUtoQyxLQUFLLENBQUNHLFdBQVcsRUFBRTtJQUMxRDtJQUNBO0lBQ0EsTUFBTSxpRUFBaUU7RUFDekU7RUFDQSxPQUFPeUIsU0FBUztBQUNsQjtBQUVBLE1BQU1LLGFBQWEsR0FBRyxDQUFDLENBQUM7QUFFeEIsTUFBTUMsUUFBUSxHQUFHO0VBQ2ZiLFNBQVMsRUFBRSxXQUFXO0VBQ3RCTixVQUFVLEVBQUUsWUFBWTtFQUN4Qk8sSUFBSSxFQUFFLE1BQU07RUFDWkUsUUFBUSxFQUFFO0FBQ1osQ0FBQztBQUVELFNBQVNXLFFBQVEsQ0FBQ0MsUUFBUSxFQUFFUCxJQUFJLEVBQUVRLGFBQWEsRUFBRTtFQUMvQyxNQUFNQyxJQUFJLEdBQUdULElBQUksQ0FBQ1UsS0FBSyxDQUFDLEdBQUcsQ0FBQztFQUM1QkQsSUFBSSxDQUFDRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ2pCSCxhQUFhLEdBQUdBLGFBQWEsSUFBSUksYUFBSyxDQUFDSixhQUFhO0VBQ3BESixhQUFhLENBQUNJLGFBQWEsQ0FBQyxHQUFHSixhQUFhLENBQUNJLGFBQWEsQ0FBQyxJQUFJdkIsU0FBUyxFQUFFO0VBQzFFLElBQUk0QixLQUFLLEdBQUdULGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNELFFBQVEsQ0FBQztFQUNsRCxLQUFLLE1BQU1PLFNBQVMsSUFBSUwsSUFBSSxFQUFFO0lBQzVCSSxLQUFLLEdBQUdBLEtBQUssQ0FBQ0MsU0FBUyxDQUFDO0lBQ3hCLElBQUksQ0FBQ0QsS0FBSyxFQUFFO01BQ1YsT0FBT0UsU0FBUztJQUNsQjtFQUNGO0VBQ0EsT0FBT0YsS0FBSztBQUNkO0FBRUEsU0FBU0csR0FBRyxDQUFDVCxRQUFRLEVBQUVQLElBQUksRUFBRWlCLE9BQU8sRUFBRVQsYUFBYSxFQUFFO0VBQ25ELE1BQU1VLGFBQWEsR0FBR2xCLElBQUksQ0FBQ1UsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDaEQsTUFBTUUsS0FBSyxHQUFHUCxRQUFRLENBQUNDLFFBQVEsRUFBRVAsSUFBSSxFQUFFUSxhQUFhLENBQUM7RUFDckQsSUFBSUssS0FBSyxDQUFDSyxhQUFhLENBQUMsRUFBRTtJQUN4QkMsY0FBTSxDQUFDQyxJQUFJLENBQ1IsZ0RBQStDRixhQUFjLGtFQUFpRSxDQUNoSTtFQUNIO0VBQ0FMLEtBQUssQ0FBQ0ssYUFBYSxDQUFDLEdBQUdELE9BQU87QUFDaEM7QUFFQSxTQUFTSSxNQUFNLENBQUNkLFFBQVEsRUFBRVAsSUFBSSxFQUFFUSxhQUFhLEVBQUU7RUFDN0MsTUFBTVUsYUFBYSxHQUFHbEIsSUFBSSxDQUFDVSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUNDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUNoRCxNQUFNRSxLQUFLLEdBQUdQLFFBQVEsQ0FBQ0MsUUFBUSxFQUFFUCxJQUFJLEVBQUVRLGFBQWEsQ0FBQztFQUNyRCxPQUFPSyxLQUFLLENBQUNLLGFBQWEsQ0FBQztBQUM3QjtBQUVBLFNBQVNJLEdBQUcsQ0FBQ2YsUUFBUSxFQUFFUCxJQUFJLEVBQUVRLGFBQWEsRUFBRTtFQUMxQyxNQUFNVSxhQUFhLEdBQUdsQixJQUFJLENBQUNVLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQ0MsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0VBQ2hELE1BQU1FLEtBQUssR0FBR1AsUUFBUSxDQUFDQyxRQUFRLEVBQUVQLElBQUksRUFBRVEsYUFBYSxDQUFDO0VBQ3JELE9BQU9LLEtBQUssQ0FBQ0ssYUFBYSxDQUFDO0FBQzdCO0FBRU8sU0FBU0ssV0FBVyxDQUFDQyxZQUFZLEVBQUVQLE9BQU8sRUFBRVEsaUJBQWlCLEVBQUVqQixhQUFhLEVBQUU7RUFDbkZRLEdBQUcsQ0FBQ1gsUUFBUSxDQUFDYixTQUFTLEVBQUVnQyxZQUFZLEVBQUVQLE9BQU8sRUFBRVQsYUFBYSxDQUFDO0VBQzdEUSxHQUFHLENBQUNYLFFBQVEsQ0FBQ25CLFVBQVUsRUFBRXNDLFlBQVksRUFBRUMsaUJBQWlCLEVBQUVqQixhQUFhLENBQUM7QUFDMUU7QUFFTyxTQUFTa0IsTUFBTSxDQUFDQyxPQUFPLEVBQUVWLE9BQU8sRUFBRVQsYUFBYSxFQUFFO0VBQ3REUSxHQUFHLENBQUNYLFFBQVEsQ0FBQ1osSUFBSSxFQUFFa0MsT0FBTyxFQUFFVixPQUFPLEVBQUVULGFBQWEsQ0FBQztBQUNyRDtBQUVPLFNBQVNvQixVQUFVLENBQUN6QixJQUFJLEVBQUVKLFNBQVMsRUFBRWtCLE9BQU8sRUFBRVQsYUFBYSxFQUFFaUIsaUJBQWlCLEVBQUU7RUFDckZ2Qiw0QkFBNEIsQ0FBQ0gsU0FBUyxFQUFFSSxJQUFJLENBQUM7RUFDN0NhLEdBQUcsQ0FBQ1gsUUFBUSxDQUFDVixRQUFRLEVBQUcsR0FBRVEsSUFBSyxJQUFHSixTQUFVLEVBQUMsRUFBRWtCLE9BQU8sRUFBRVQsYUFBYSxDQUFDO0VBQ3RFUSxHQUFHLENBQUNYLFFBQVEsQ0FBQ25CLFVBQVUsRUFBRyxHQUFFaUIsSUFBSyxJQUFHSixTQUFVLEVBQUMsRUFBRTBCLGlCQUFpQixFQUFFakIsYUFBYSxDQUFDO0FBQ3BGO0FBRU8sU0FBU3FCLGlCQUFpQixDQUFDMUIsSUFBSSxFQUFFYyxPQUFPLEVBQUVULGFBQWEsRUFBRWlCLGlCQUFpQixFQUFFO0VBQ2pGVCxHQUFHLENBQUNYLFFBQVEsQ0FBQ1YsUUFBUSxFQUFHLEdBQUVRLElBQUssSUFBR25CLGdCQUFpQixFQUFDLEVBQUVpQyxPQUFPLEVBQUVULGFBQWEsQ0FBQztFQUM3RVEsR0FBRyxDQUFDWCxRQUFRLENBQUNuQixVQUFVLEVBQUcsR0FBRWlCLElBQUssSUFBR25CLGdCQUFpQixFQUFDLEVBQUV5QyxpQkFBaUIsRUFBRWpCLGFBQWEsQ0FBQztBQUMzRjtBQUVPLFNBQVNzQix3QkFBd0IsQ0FBQ2IsT0FBTyxFQUFFVCxhQUFhLEVBQUU7RUFDL0RBLGFBQWEsR0FBR0EsYUFBYSxJQUFJSSxhQUFLLENBQUNKLGFBQWE7RUFDcERKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLEdBQUdKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLElBQUl2QixTQUFTLEVBQUU7RUFDMUVtQixhQUFhLENBQUNJLGFBQWEsQ0FBQyxDQUFDZCxTQUFTLENBQUNxQyxJQUFJLENBQUNkLE9BQU8sQ0FBQztBQUN0RDtBQUVPLFNBQVNlLGNBQWMsQ0FBQ1IsWUFBWSxFQUFFaEIsYUFBYSxFQUFFO0VBQzFEYSxNQUFNLENBQUNoQixRQUFRLENBQUNiLFNBQVMsRUFBRWdDLFlBQVksRUFBRWhCLGFBQWEsQ0FBQztBQUN6RDtBQUVPLFNBQVN5QixhQUFhLENBQUM5QixJQUFJLEVBQUVKLFNBQVMsRUFBRVMsYUFBYSxFQUFFO0VBQzVEYSxNQUFNLENBQUNoQixRQUFRLENBQUNWLFFBQVEsRUFBRyxHQUFFUSxJQUFLLElBQUdKLFNBQVUsRUFBQyxFQUFFUyxhQUFhLENBQUM7QUFDbEU7QUFFTyxTQUFTMEIsY0FBYyxHQUFHO0VBQy9CL0MsTUFBTSxDQUFDQyxJQUFJLENBQUNnQixhQUFhLENBQUMsQ0FBQytCLE9BQU8sQ0FBQ0MsS0FBSyxJQUFJLE9BQU9oQyxhQUFhLENBQUNnQyxLQUFLLENBQUMsQ0FBQztBQUMxRTtBQUVPLFNBQVNDLGlCQUFpQixDQUFDQyxNQUFNLEVBQUV2QyxTQUFTLEVBQUU7RUFDbkQsSUFBSSxDQUFDdUMsTUFBTSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0MsTUFBTSxFQUFFO0lBQzdCLE9BQU8sQ0FBQyxDQUFDO0VBQ1g7RUFDQSxNQUFNQSxNQUFNLEdBQUdELE1BQU0sQ0FBQ0MsTUFBTSxFQUFFO0VBQzlCLE1BQU1DLGVBQWUsR0FBRzVCLGFBQUssQ0FBQzZCLFdBQVcsQ0FBQ0Msd0JBQXdCLEVBQUU7RUFDcEUsTUFBTSxDQUFDQyxPQUFPLENBQUMsR0FBR0gsZUFBZSxDQUFDSSxhQUFhLENBQUNOLE1BQU0sQ0FBQ08sbUJBQW1CLEVBQUUsQ0FBQztFQUM3RSxLQUFLLE1BQU10RCxHQUFHLElBQUlvRCxPQUFPLEVBQUU7SUFDekIsTUFBTUcsR0FBRyxHQUFHUixNQUFNLENBQUNoQixHQUFHLENBQUMvQixHQUFHLENBQUM7SUFDM0IsSUFBSSxDQUFDdUQsR0FBRyxJQUFJLENBQUNBLEdBQUcsQ0FBQ0MsV0FBVyxFQUFFO01BQzVCUixNQUFNLENBQUNoRCxHQUFHLENBQUMsR0FBR3VELEdBQUc7TUFDakI7SUFDRjtJQUNBUCxNQUFNLENBQUNoRCxHQUFHLENBQUMsR0FBR3VELEdBQUcsQ0FBQ0MsV0FBVyxFQUFFO0VBQ2pDO0VBQ0EsSUFBSWhELFNBQVMsRUFBRTtJQUNid0MsTUFBTSxDQUFDeEMsU0FBUyxHQUFHQSxTQUFTO0VBQzlCO0VBQ0EsT0FBT3dDLE1BQU07QUFDZjtBQUVPLFNBQVNTLFVBQVUsQ0FBQ2pELFNBQVMsRUFBRWtELFdBQVcsRUFBRXpDLGFBQWEsRUFBRTtFQUNoRSxJQUFJLENBQUNBLGFBQWEsRUFBRTtJQUNsQixNQUFNLHVCQUF1QjtFQUMvQjtFQUNBLE9BQU9jLEdBQUcsQ0FBQ2pCLFFBQVEsQ0FBQ1YsUUFBUSxFQUFHLEdBQUVzRCxXQUFZLElBQUdsRCxTQUFVLEVBQUMsRUFBRVMsYUFBYSxDQUFDO0FBQzdFO0FBRU8sZUFBZTBDLFVBQVUsQ0FBQ0MsT0FBTyxFQUFFbkQsSUFBSSxFQUFFb0QsT0FBTyxFQUFFQyxJQUFJLEVBQUU7RUFDN0QsSUFBSSxDQUFDRixPQUFPLEVBQUU7SUFDWjtFQUNGO0VBQ0EsTUFBTUcsaUJBQWlCLENBQUNGLE9BQU8sRUFBRXBELElBQUksRUFBRXFELElBQUksQ0FBQztFQUM1QyxJQUFJRCxPQUFPLENBQUNHLGlCQUFpQixFQUFFO0lBQzdCO0VBQ0Y7RUFDQSxPQUFPLE1BQU1KLE9BQU8sQ0FBQ0MsT0FBTyxDQUFDO0FBQy9CO0FBRU8sU0FBU0ksYUFBYSxDQUFDekQsU0FBaUIsRUFBRUksSUFBWSxFQUFFSyxhQUFxQixFQUFXO0VBQzdGLE9BQU93QyxVQUFVLENBQUNqRCxTQUFTLEVBQUVJLElBQUksRUFBRUssYUFBYSxDQUFDLElBQUlPLFNBQVM7QUFDaEU7QUFFTyxTQUFTMEMsV0FBVyxDQUFDakMsWUFBWSxFQUFFaEIsYUFBYSxFQUFFO0VBQ3ZELE9BQU9jLEdBQUcsQ0FBQ2pCLFFBQVEsQ0FBQ2IsU0FBUyxFQUFFZ0MsWUFBWSxFQUFFaEIsYUFBYSxDQUFDO0FBQzdEO0FBRU8sU0FBU2tELGdCQUFnQixDQUFDbEQsYUFBYSxFQUFFO0VBQzlDLE1BQU1LLEtBQUssR0FDUlQsYUFBYSxDQUFDSSxhQUFhLENBQUMsSUFBSUosYUFBYSxDQUFDSSxhQUFhLENBQUMsQ0FBQ0gsUUFBUSxDQUFDYixTQUFTLENBQUMsSUFBSyxDQUFDLENBQUM7RUFDMUYsTUFBTW1FLGFBQWEsR0FBRyxFQUFFO0VBQ3hCLE1BQU1DLG9CQUFvQixHQUFHLENBQUNDLFNBQVMsRUFBRWhELEtBQUssS0FBSztJQUNqRDFCLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDeUIsS0FBSyxDQUFDLENBQUNzQixPQUFPLENBQUNuQyxJQUFJLElBQUk7TUFDakMsTUFBTThELEtBQUssR0FBR2pELEtBQUssQ0FBQ2IsSUFBSSxDQUFDO01BQ3pCLElBQUk2RCxTQUFTLEVBQUU7UUFDYjdELElBQUksR0FBSSxHQUFFNkQsU0FBVSxJQUFHN0QsSUFBSyxFQUFDO01BQy9CO01BQ0EsSUFBSSxPQUFPOEQsS0FBSyxLQUFLLFVBQVUsRUFBRTtRQUMvQkgsYUFBYSxDQUFDNUIsSUFBSSxDQUFDL0IsSUFBSSxDQUFDO01BQzFCLENBQUMsTUFBTTtRQUNMNEQsb0JBQW9CLENBQUM1RCxJQUFJLEVBQUU4RCxLQUFLLENBQUM7TUFDbkM7SUFDRixDQUFDLENBQUM7RUFDSixDQUFDO0VBQ0RGLG9CQUFvQixDQUFDLElBQUksRUFBRS9DLEtBQUssQ0FBQztFQUNqQyxPQUFPOEMsYUFBYTtBQUN0QjtBQUVPLFNBQVNJLE1BQU0sQ0FBQ3BDLE9BQU8sRUFBRW5CLGFBQWEsRUFBRTtFQUM3QyxPQUFPYyxHQUFHLENBQUNqQixRQUFRLENBQUNaLElBQUksRUFBRWtDLE9BQU8sRUFBRW5CLGFBQWEsQ0FBQztBQUNuRDtBQUVPLFNBQVN3RCxPQUFPLENBQUN4RCxhQUFhLEVBQUU7RUFDckMsSUFBSXlELE9BQU8sR0FBRzdELGFBQWEsQ0FBQ0ksYUFBYSxDQUFDO0VBQzFDLElBQUl5RCxPQUFPLElBQUlBLE9BQU8sQ0FBQ3hFLElBQUksRUFBRTtJQUMzQixPQUFPd0UsT0FBTyxDQUFDeEUsSUFBSTtFQUNyQjtFQUNBLE9BQU9zQixTQUFTO0FBQ2xCO0FBRU8sU0FBU21ELFlBQVksQ0FBQzFDLFlBQVksRUFBRWhCLGFBQWEsRUFBRTtFQUN4RCxPQUFPYyxHQUFHLENBQUNqQixRQUFRLENBQUNuQixVQUFVLEVBQUVzQyxZQUFZLEVBQUVoQixhQUFhLENBQUM7QUFDOUQ7QUFFTyxTQUFTMkQsZ0JBQWdCLENBQzlCbEIsV0FBVyxFQUNYSSxJQUFJLEVBQ0plLFdBQVcsRUFDWEMsbUJBQW1CLEVBQ25CQyxNQUFNLEVBQ05DLE9BQU8sRUFDUDtFQUNBLE1BQU1uQixPQUFPLEdBQUc7SUFDZG9CLFdBQVcsRUFBRXZCLFdBQVc7SUFDeEJYLE1BQU0sRUFBRThCLFdBQVc7SUFDbkJLLE1BQU0sRUFBRSxLQUFLO0lBQ2JDLEdBQUcsRUFBRUosTUFBTSxDQUFDSyxnQkFBZ0I7SUFDNUJDLE9BQU8sRUFBRU4sTUFBTSxDQUFDTSxPQUFPO0lBQ3ZCQyxFQUFFLEVBQUVQLE1BQU0sQ0FBQ087RUFDYixDQUFDO0VBRUQsSUFBSVIsbUJBQW1CLEVBQUU7SUFDdkJqQixPQUFPLENBQUMwQixRQUFRLEdBQUdULG1CQUFtQjtFQUN4QztFQUNBLElBQ0VwQixXQUFXLEtBQUs5RSxLQUFLLENBQUNJLFVBQVUsSUFDaEMwRSxXQUFXLEtBQUs5RSxLQUFLLENBQUNLLFNBQVMsSUFDL0J5RSxXQUFXLEtBQUs5RSxLQUFLLENBQUNNLFlBQVksSUFDbEN3RSxXQUFXLEtBQUs5RSxLQUFLLENBQUNPLFdBQVcsSUFDakN1RSxXQUFXLEtBQUs5RSxLQUFLLENBQUNTLFNBQVMsRUFDL0I7SUFDQTtJQUNBd0UsT0FBTyxDQUFDbUIsT0FBTyxHQUFHcEYsTUFBTSxDQUFDNEYsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFUixPQUFPLENBQUM7RUFDOUM7RUFFQSxJQUFJLENBQUNsQixJQUFJLEVBQUU7SUFDVCxPQUFPRCxPQUFPO0VBQ2hCO0VBQ0EsSUFBSUMsSUFBSSxDQUFDMkIsUUFBUSxFQUFFO0lBQ2pCNUIsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUk7RUFDMUI7RUFDQSxJQUFJQyxJQUFJLENBQUM0QixJQUFJLEVBQUU7SUFDYjdCLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBR0MsSUFBSSxDQUFDNEIsSUFBSTtFQUM3QjtFQUNBLElBQUk1QixJQUFJLENBQUM2QixjQUFjLEVBQUU7SUFDdkI5QixPQUFPLENBQUMsZ0JBQWdCLENBQUMsR0FBR0MsSUFBSSxDQUFDNkIsY0FBYztFQUNqRDtFQUNBLE9BQU85QixPQUFPO0FBQ2hCO0FBRU8sU0FBUytCLHFCQUFxQixDQUFDbEMsV0FBVyxFQUFFSSxJQUFJLEVBQUUrQixLQUFLLEVBQUVDLEtBQUssRUFBRWYsTUFBTSxFQUFFQyxPQUFPLEVBQUVlLEtBQUssRUFBRTtFQUM3RkEsS0FBSyxHQUFHLENBQUMsQ0FBQ0EsS0FBSztFQUVmLElBQUlsQyxPQUFPLEdBQUc7SUFDWm9CLFdBQVcsRUFBRXZCLFdBQVc7SUFDeEJtQyxLQUFLO0lBQ0xYLE1BQU0sRUFBRSxLQUFLO0lBQ2JZLEtBQUs7SUFDTFgsR0FBRyxFQUFFSixNQUFNLENBQUNLLGdCQUFnQjtJQUM1QlcsS0FBSztJQUNMVixPQUFPLEVBQUVOLE1BQU0sQ0FBQ00sT0FBTztJQUN2QkMsRUFBRSxFQUFFUCxNQUFNLENBQUNPLEVBQUU7SUFDYk4sT0FBTyxFQUFFQSxPQUFPLElBQUksQ0FBQztFQUN2QixDQUFDO0VBRUQsSUFBSSxDQUFDbEIsSUFBSSxFQUFFO0lBQ1QsT0FBT0QsT0FBTztFQUNoQjtFQUNBLElBQUlDLElBQUksQ0FBQzJCLFFBQVEsRUFBRTtJQUNqQjVCLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJO0VBQzFCO0VBQ0EsSUFBSUMsSUFBSSxDQUFDNEIsSUFBSSxFQUFFO0lBQ2I3QixPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUdDLElBQUksQ0FBQzRCLElBQUk7RUFDN0I7RUFDQSxJQUFJNUIsSUFBSSxDQUFDNkIsY0FBYyxFQUFFO0lBQ3ZCOUIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUdDLElBQUksQ0FBQzZCLGNBQWM7RUFDakQ7RUFDQSxPQUFPOUIsT0FBTztBQUNoQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNtQyxpQkFBaUIsQ0FBQ25DLE9BQU8sRUFBRW9DLE9BQU8sRUFBRUMsTUFBTSxFQUFFO0VBQzFELE9BQU87SUFDTEMsT0FBTyxFQUFFLFVBQVVDLFFBQVEsRUFBRTtNQUMzQixJQUFJdkMsT0FBTyxDQUFDb0IsV0FBVyxLQUFLckcsS0FBSyxDQUFDUyxTQUFTLEVBQUU7UUFDM0MsSUFBSSxDQUFDK0csUUFBUSxFQUFFO1VBQ2JBLFFBQVEsR0FBR3ZDLE9BQU8sQ0FBQ3dDLE9BQU87UUFDNUI7UUFDQUQsUUFBUSxHQUFHQSxRQUFRLENBQUNFLEdBQUcsQ0FBQ3ZELE1BQU0sSUFBSTtVQUNoQyxPQUFPRCxpQkFBaUIsQ0FBQ0MsTUFBTSxDQUFDO1FBQ2xDLENBQUMsQ0FBQztRQUNGLE9BQU9rRCxPQUFPLENBQUNHLFFBQVEsQ0FBQztNQUMxQjtNQUNBO01BQ0EsSUFDRUEsUUFBUSxJQUNSLE9BQU9BLFFBQVEsS0FBSyxRQUFRLElBQzVCLENBQUN2QyxPQUFPLENBQUNkLE1BQU0sQ0FBQ3dELE1BQU0sQ0FBQ0gsUUFBUSxDQUFDLElBQ2hDdkMsT0FBTyxDQUFDb0IsV0FBVyxLQUFLckcsS0FBSyxDQUFDSSxVQUFVLEVBQ3hDO1FBQ0EsT0FBT2lILE9BQU8sQ0FBQ0csUUFBUSxDQUFDO01BQzFCO01BQ0EsSUFBSUEsUUFBUSxJQUFJLE9BQU9BLFFBQVEsS0FBSyxRQUFRLElBQUl2QyxPQUFPLENBQUNvQixXQUFXLEtBQUtyRyxLQUFLLENBQUNLLFNBQVMsRUFBRTtRQUN2RixPQUFPZ0gsT0FBTyxDQUFDRyxRQUFRLENBQUM7TUFDMUI7TUFDQSxJQUFJdkMsT0FBTyxDQUFDb0IsV0FBVyxLQUFLckcsS0FBSyxDQUFDSyxTQUFTLEVBQUU7UUFDM0MsT0FBT2dILE9BQU8sRUFBRTtNQUNsQjtNQUNBRyxRQUFRLEdBQUcsQ0FBQyxDQUFDO01BQ2IsSUFBSXZDLE9BQU8sQ0FBQ29CLFdBQVcsS0FBS3JHLEtBQUssQ0FBQ0ksVUFBVSxFQUFFO1FBQzVDb0gsUUFBUSxDQUFDLFFBQVEsQ0FBQyxHQUFHdkMsT0FBTyxDQUFDZCxNQUFNLENBQUN5RCxZQUFZLEVBQUU7UUFDbERKLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBR3ZDLE9BQU8sQ0FBQ2QsTUFBTSxDQUFDMEQsRUFBRTtNQUNwRDtNQUNBLE9BQU9SLE9BQU8sQ0FBQ0csUUFBUSxDQUFDO0lBQzFCLENBQUM7SUFDRE0sS0FBSyxFQUFFLFVBQVVBLEtBQUssRUFBRTtNQUN0QixNQUFNQyxDQUFDLEdBQUdDLFlBQVksQ0FBQ0YsS0FBSyxFQUFFO1FBQzVCRyxJQUFJLEVBQUV4RixhQUFLLENBQUN5RixLQUFLLENBQUNDLGFBQWE7UUFDL0JDLE9BQU8sRUFBRTtNQUNYLENBQUMsQ0FBQztNQUNGZCxNQUFNLENBQUNTLENBQUMsQ0FBQztJQUNYO0VBQ0YsQ0FBQztBQUNIO0FBRUEsU0FBU00sWUFBWSxDQUFDbkQsSUFBSSxFQUFFO0VBQzFCLE9BQU9BLElBQUksSUFBSUEsSUFBSSxDQUFDNEIsSUFBSSxHQUFHNUIsSUFBSSxDQUFDNEIsSUFBSSxDQUFDZSxFQUFFLEdBQUdqRixTQUFTO0FBQ3JEO0FBRUEsU0FBUzBGLG1CQUFtQixDQUFDeEQsV0FBVyxFQUFFbEQsU0FBUyxFQUFFMkcsS0FBSyxFQUFFckQsSUFBSSxFQUFFc0QsUUFBUSxFQUFFO0VBQzFFLE1BQU1DLFVBQVUsR0FBR3pGLGNBQU0sQ0FBQzBGLGtCQUFrQixDQUFDQyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0wsS0FBSyxDQUFDLENBQUM7RUFDbkV2RixjQUFNLENBQUN3RixRQUFRLENBQUMsQ0FDYixHQUFFMUQsV0FBWSxrQkFBaUJsRCxTQUFVLGFBQVl5RyxZQUFZLENBQ2hFbkQsSUFBSSxDQUNKLGVBQWN1RCxVQUFXLEVBQUMsRUFDNUI7SUFDRTdHLFNBQVM7SUFDVGtELFdBQVc7SUFDWGdDLElBQUksRUFBRXVCLFlBQVksQ0FBQ25ELElBQUk7RUFDekIsQ0FBQyxDQUNGO0FBQ0g7QUFFQSxTQUFTMkQsMkJBQTJCLENBQUMvRCxXQUFXLEVBQUVsRCxTQUFTLEVBQUUyRyxLQUFLLEVBQUVPLE1BQU0sRUFBRTVELElBQUksRUFBRXNELFFBQVEsRUFBRTtFQUMxRixNQUFNQyxVQUFVLEdBQUd6RixjQUFNLENBQUMwRixrQkFBa0IsQ0FBQ0MsSUFBSSxDQUFDQyxTQUFTLENBQUNMLEtBQUssQ0FBQyxDQUFDO0VBQ25FLE1BQU1RLFdBQVcsR0FBRy9GLGNBQU0sQ0FBQzBGLGtCQUFrQixDQUFDQyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0UsTUFBTSxDQUFDLENBQUM7RUFDckU5RixjQUFNLENBQUN3RixRQUFRLENBQUMsQ0FDYixHQUFFMUQsV0FBWSxrQkFBaUJsRCxTQUFVLGFBQVl5RyxZQUFZLENBQ2hFbkQsSUFBSSxDQUNKLGVBQWN1RCxVQUFXLGVBQWNNLFdBQVksRUFBQyxFQUN0RDtJQUNFbkgsU0FBUztJQUNUa0QsV0FBVztJQUNYZ0MsSUFBSSxFQUFFdUIsWUFBWSxDQUFDbkQsSUFBSTtFQUN6QixDQUFDLENBQ0Y7QUFDSDtBQUVBLFNBQVM4RCx5QkFBeUIsQ0FBQ2xFLFdBQVcsRUFBRWxELFNBQVMsRUFBRTJHLEtBQUssRUFBRXJELElBQUksRUFBRTRDLEtBQUssRUFBRVUsUUFBUSxFQUFFO0VBQ3ZGLE1BQU1DLFVBQVUsR0FBR3pGLGNBQU0sQ0FBQzBGLGtCQUFrQixDQUFDQyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0wsS0FBSyxDQUFDLENBQUM7RUFDbkV2RixjQUFNLENBQUN3RixRQUFRLENBQUMsQ0FDYixHQUFFMUQsV0FBWSxlQUFjbEQsU0FBVSxhQUFZeUcsWUFBWSxDQUM3RG5ELElBQUksQ0FDSixlQUFjdUQsVUFBVyxjQUFhRSxJQUFJLENBQUNDLFNBQVMsQ0FBQ2QsS0FBSyxDQUFFLEVBQUMsRUFDL0Q7SUFDRWxHLFNBQVM7SUFDVGtELFdBQVc7SUFDWGdELEtBQUs7SUFDTGhCLElBQUksRUFBRXVCLFlBQVksQ0FBQ25ELElBQUk7RUFDekIsQ0FBQyxDQUNGO0FBQ0g7QUFFTyxTQUFTK0Qsd0JBQXdCLENBQ3RDbkUsV0FBVyxFQUNYSSxJQUFJLEVBQ0p0RCxTQUFTLEVBQ1Q2RixPQUFPLEVBQ1B0QixNQUFNLEVBQ05jLEtBQUssRUFDTGIsT0FBTyxFQUNQO0VBQ0EsT0FBTyxJQUFJOEMsT0FBTyxDQUFDLENBQUM3QixPQUFPLEVBQUVDLE1BQU0sS0FBSztJQUN0QyxNQUFNdEMsT0FBTyxHQUFHSCxVQUFVLENBQUNqRCxTQUFTLEVBQUVrRCxXQUFXLEVBQUVxQixNQUFNLENBQUM5RCxhQUFhLENBQUM7SUFDeEUsSUFBSSxDQUFDMkMsT0FBTyxFQUFFO01BQ1osT0FBT3FDLE9BQU8sRUFBRTtJQUNsQjtJQUNBLE1BQU1wQyxPQUFPLEdBQUdlLGdCQUFnQixDQUFDbEIsV0FBVyxFQUFFSSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRWlCLE1BQU0sRUFBRUMsT0FBTyxDQUFDO0lBQ2hGLElBQUlhLEtBQUssRUFBRTtNQUNUaEMsT0FBTyxDQUFDZ0MsS0FBSyxHQUFHQSxLQUFLO0lBQ3ZCO0lBQ0EsTUFBTTtNQUFFTSxPQUFPO01BQUVPO0lBQU0sQ0FBQyxHQUFHVixpQkFBaUIsQ0FDMUNuQyxPQUFPLEVBQ1BkLE1BQU0sSUFBSTtNQUNSa0QsT0FBTyxDQUFDbEQsTUFBTSxDQUFDO0lBQ2pCLENBQUMsRUFDRDJELEtBQUssSUFBSTtNQUNQUixNQUFNLENBQUNRLEtBQUssQ0FBQztJQUNmLENBQUMsQ0FDRjtJQUNEZSwyQkFBMkIsQ0FDekIvRCxXQUFXLEVBQ1hsRCxTQUFTLEVBQ1QsV0FBVyxFQUNYK0csSUFBSSxDQUFDQyxTQUFTLENBQUNuQixPQUFPLENBQUMsRUFDdkJ2QyxJQUFJLEVBQ0ppQixNQUFNLENBQUNnRCxTQUFTLENBQUNDLG9CQUFvQixDQUN0QztJQUNEbkUsT0FBTyxDQUFDd0MsT0FBTyxHQUFHQSxPQUFPLENBQUNDLEdBQUcsQ0FBQ3ZELE1BQU0sSUFBSTtNQUN0QztNQUNBQSxNQUFNLENBQUN2QyxTQUFTLEdBQUdBLFNBQVM7TUFDNUIsT0FBT2EsYUFBSyxDQUFDekIsTUFBTSxDQUFDcUksUUFBUSxDQUFDbEYsTUFBTSxDQUFDO0lBQ3RDLENBQUMsQ0FBQztJQUNGLE9BQU8rRSxPQUFPLENBQUM3QixPQUFPLEVBQUUsQ0FDckJpQyxJQUFJLENBQUMsTUFBTTtNQUNWLE9BQU9uRSxpQkFBaUIsQ0FBQ0YsT0FBTyxFQUFHLEdBQUVILFdBQVksSUFBR2xELFNBQVUsRUFBQyxFQUFFc0QsSUFBSSxDQUFDO0lBQ3hFLENBQUMsQ0FBQyxDQUNEb0UsSUFBSSxDQUFDLE1BQU07TUFDVixJQUFJckUsT0FBTyxDQUFDRyxpQkFBaUIsRUFBRTtRQUM3QixPQUFPSCxPQUFPLENBQUN3QyxPQUFPO01BQ3hCO01BQ0EsTUFBTUQsUUFBUSxHQUFHeEMsT0FBTyxDQUFDQyxPQUFPLENBQUM7TUFDakMsSUFBSXVDLFFBQVEsSUFBSSxPQUFPQSxRQUFRLENBQUM4QixJQUFJLEtBQUssVUFBVSxFQUFFO1FBQ25ELE9BQU85QixRQUFRLENBQUM4QixJQUFJLENBQUNDLE9BQU8sSUFBSTtVQUM5QixPQUFPQSxPQUFPO1FBQ2hCLENBQUMsQ0FBQztNQUNKO01BQ0EsT0FBTy9CLFFBQVE7SUFDakIsQ0FBQyxDQUFDLENBQ0Q4QixJQUFJLENBQUMvQixPQUFPLEVBQUVPLEtBQUssQ0FBQztFQUN6QixDQUFDLENBQUMsQ0FBQ3dCLElBQUksQ0FBQ0MsT0FBTyxJQUFJO0lBQ2pCakIsbUJBQW1CLENBQ2pCeEQsV0FBVyxFQUNYbEQsU0FBUyxFQUNUK0csSUFBSSxDQUFDQyxTQUFTLENBQUNXLE9BQU8sQ0FBQyxFQUN2QnJFLElBQUksRUFDSmlCLE1BQU0sQ0FBQ2dELFNBQVMsQ0FBQ0ssWUFBWSxDQUM5QjtJQUNELE9BQU9ELE9BQU87RUFDaEIsQ0FBQyxDQUFDO0FBQ0o7QUFFTyxTQUFTRSxvQkFBb0IsQ0FDbEMzRSxXQUFXLEVBQ1hsRCxTQUFTLEVBQ1Q4SCxTQUFTLEVBQ1RDLFdBQVcsRUFDWHhELE1BQU0sRUFDTmpCLElBQUksRUFDSmtCLE9BQU8sRUFDUGUsS0FBSyxFQUNMO0VBQ0EsTUFBTW5DLE9BQU8sR0FBR0gsVUFBVSxDQUFDakQsU0FBUyxFQUFFa0QsV0FBVyxFQUFFcUIsTUFBTSxDQUFDOUQsYUFBYSxDQUFDO0VBQ3hFLElBQUksQ0FBQzJDLE9BQU8sRUFBRTtJQUNaLE9BQU9rRSxPQUFPLENBQUM3QixPQUFPLENBQUM7TUFDckJxQyxTQUFTO01BQ1RDO0lBQ0YsQ0FBQyxDQUFDO0VBQ0o7RUFDQSxNQUFNQyxJQUFJLEdBQUc1SSxNQUFNLENBQUM0RixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUrQyxXQUFXLENBQUM7RUFDM0NDLElBQUksQ0FBQ0MsS0FBSyxHQUFHSCxTQUFTO0VBRXRCLE1BQU1JLFVBQVUsR0FBRyxJQUFJckgsYUFBSyxDQUFDc0gsS0FBSyxDQUFDbkksU0FBUyxDQUFDO0VBQzdDa0ksVUFBVSxDQUFDRSxRQUFRLENBQUNKLElBQUksQ0FBQztFQUV6QixJQUFJMUMsS0FBSyxHQUFHLEtBQUs7RUFDakIsSUFBSXlDLFdBQVcsRUFBRTtJQUNmekMsS0FBSyxHQUFHLENBQUMsQ0FBQ3lDLFdBQVcsQ0FBQ3pDLEtBQUs7RUFDN0I7RUFDQSxNQUFNK0MsYUFBYSxHQUFHakQscUJBQXFCLENBQ3pDbEMsV0FBVyxFQUNYSSxJQUFJLEVBQ0o0RSxVQUFVLEVBQ1Y1QyxLQUFLLEVBQ0xmLE1BQU0sRUFDTkMsT0FBTyxFQUNQZSxLQUFLLENBQ047RUFDRCxPQUFPK0IsT0FBTyxDQUFDN0IsT0FBTyxFQUFFLENBQ3JCaUMsSUFBSSxDQUFDLE1BQU07SUFDVixPQUFPbkUsaUJBQWlCLENBQUM4RSxhQUFhLEVBQUcsR0FBRW5GLFdBQVksSUFBR2xELFNBQVUsRUFBQyxFQUFFc0QsSUFBSSxDQUFDO0VBQzlFLENBQUMsQ0FBQyxDQUNEb0UsSUFBSSxDQUFDLE1BQU07SUFDVixJQUFJVyxhQUFhLENBQUM3RSxpQkFBaUIsRUFBRTtNQUNuQyxPQUFPNkUsYUFBYSxDQUFDaEQsS0FBSztJQUM1QjtJQUNBLE9BQU9qQyxPQUFPLENBQUNpRixhQUFhLENBQUM7RUFDL0IsQ0FBQyxDQUFDLENBQ0RYLElBQUksQ0FDSFIsTUFBTSxJQUFJO0lBQ1IsSUFBSW9CLFdBQVcsR0FBR0osVUFBVTtJQUM1QixJQUFJaEIsTUFBTSxJQUFJQSxNQUFNLFlBQVlyRyxhQUFLLENBQUNzSCxLQUFLLEVBQUU7TUFDM0NHLFdBQVcsR0FBR3BCLE1BQU07SUFDdEI7SUFDQSxNQUFNcUIsU0FBUyxHQUFHRCxXQUFXLENBQUM5RixNQUFNLEVBQUU7SUFDdEMsSUFBSStGLFNBQVMsQ0FBQ04sS0FBSyxFQUFFO01BQ25CSCxTQUFTLEdBQUdTLFNBQVMsQ0FBQ04sS0FBSztJQUM3QjtJQUNBLElBQUlNLFNBQVMsQ0FBQ0MsS0FBSyxFQUFFO01BQ25CVCxXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ1MsS0FBSyxHQUFHRCxTQUFTLENBQUNDLEtBQUs7SUFDckM7SUFDQSxJQUFJRCxTQUFTLENBQUNFLElBQUksRUFBRTtNQUNsQlYsV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUNVLElBQUksR0FBR0YsU0FBUyxDQUFDRSxJQUFJO0lBQ25DO0lBQ0EsSUFBSUYsU0FBUyxDQUFDRyxPQUFPLEVBQUU7TUFDckJYLFdBQVcsR0FBR0EsV0FBVyxJQUFJLENBQUMsQ0FBQztNQUMvQkEsV0FBVyxDQUFDVyxPQUFPLEdBQUdILFNBQVMsQ0FBQ0csT0FBTztJQUN6QztJQUNBLElBQUlILFNBQVMsQ0FBQ0ksV0FBVyxFQUFFO01BQ3pCWixXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ1ksV0FBVyxHQUFHSixTQUFTLENBQUNJLFdBQVc7SUFDakQ7SUFDQSxJQUFJSixTQUFTLENBQUNLLE9BQU8sRUFBRTtNQUNyQmIsV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUNhLE9BQU8sR0FBR0wsU0FBUyxDQUFDSyxPQUFPO0lBQ3pDO0lBQ0EsSUFBSUwsU0FBUyxDQUFDbEosSUFBSSxFQUFFO01BQ2xCMEksV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUMxSSxJQUFJLEdBQUdrSixTQUFTLENBQUNsSixJQUFJO0lBQ25DO0lBQ0EsSUFBSWtKLFNBQVMsQ0FBQ00sS0FBSyxFQUFFO01BQ25CZCxXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ2MsS0FBSyxHQUFHTixTQUFTLENBQUNNLEtBQUs7SUFDckM7SUFDQSxJQUFJTixTQUFTLENBQUNPLElBQUksRUFBRTtNQUNsQmYsV0FBVyxHQUFHQSxXQUFXLElBQUksQ0FBQyxDQUFDO01BQy9CQSxXQUFXLENBQUNlLElBQUksR0FBR1AsU0FBUyxDQUFDTyxJQUFJO0lBQ25DO0lBQ0EsSUFBSVQsYUFBYSxDQUFDVSxjQUFjLEVBQUU7TUFDaENoQixXQUFXLEdBQUdBLFdBQVcsSUFBSSxDQUFDLENBQUM7TUFDL0JBLFdBQVcsQ0FBQ2dCLGNBQWMsR0FBR1YsYUFBYSxDQUFDVSxjQUFjO0lBQzNEO0lBQ0EsSUFBSVYsYUFBYSxDQUFDVyxxQkFBcUIsRUFBRTtNQUN2Q2pCLFdBQVcsR0FBR0EsV0FBVyxJQUFJLENBQUMsQ0FBQztNQUMvQkEsV0FBVyxDQUFDaUIscUJBQXFCLEdBQUdYLGFBQWEsQ0FBQ1cscUJBQXFCO0lBQ3pFO0lBQ0EsSUFBSVgsYUFBYSxDQUFDWSxzQkFBc0IsRUFBRTtNQUN4Q2xCLFdBQVcsR0FBR0EsV0FBVyxJQUFJLENBQUMsQ0FBQztNQUMvQkEsV0FBVyxDQUFDa0Isc0JBQXNCLEdBQUdaLGFBQWEsQ0FBQ1ksc0JBQXNCO0lBQzNFO0lBQ0EsT0FBTztNQUNMbkIsU0FBUztNQUNUQztJQUNGLENBQUM7RUFDSCxDQUFDLEVBQ0RtQixHQUFHLElBQUk7SUFDTCxNQUFNaEQsS0FBSyxHQUFHRSxZQUFZLENBQUM4QyxHQUFHLEVBQUU7TUFDOUI3QyxJQUFJLEVBQUV4RixhQUFLLENBQUN5RixLQUFLLENBQUNDLGFBQWE7TUFDL0JDLE9BQU8sRUFBRTtJQUNYLENBQUMsQ0FBQztJQUNGLE1BQU1OLEtBQUs7RUFDYixDQUFDLENBQ0Y7QUFDTDtBQUVPLFNBQVNFLFlBQVksQ0FBQ0ksT0FBTyxFQUFFMkMsV0FBVyxFQUFFO0VBQ2pELElBQUksQ0FBQ0EsV0FBVyxFQUFFO0lBQ2hCQSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0VBQ2xCO0VBQ0EsSUFBSSxDQUFDM0MsT0FBTyxFQUFFO0lBQ1osT0FBTyxJQUFJM0YsYUFBSyxDQUFDeUYsS0FBSyxDQUNwQjZDLFdBQVcsQ0FBQzlDLElBQUksSUFBSXhGLGFBQUssQ0FBQ3lGLEtBQUssQ0FBQ0MsYUFBYSxFQUM3QzRDLFdBQVcsQ0FBQzNDLE9BQU8sSUFBSSxnQkFBZ0IsQ0FDeEM7RUFDSDtFQUNBLElBQUlBLE9BQU8sWUFBWTNGLGFBQUssQ0FBQ3lGLEtBQUssRUFBRTtJQUNsQyxPQUFPRSxPQUFPO0VBQ2hCO0VBRUEsTUFBTUgsSUFBSSxHQUFHOEMsV0FBVyxDQUFDOUMsSUFBSSxJQUFJeEYsYUFBSyxDQUFDeUYsS0FBSyxDQUFDQyxhQUFhO0VBQzFEO0VBQ0EsSUFBSSxPQUFPQyxPQUFPLEtBQUssUUFBUSxFQUFFO0lBQy9CLE9BQU8sSUFBSTNGLGFBQUssQ0FBQ3lGLEtBQUssQ0FBQ0QsSUFBSSxFQUFFRyxPQUFPLENBQUM7RUFDdkM7RUFDQSxNQUFNTixLQUFLLEdBQUcsSUFBSXJGLGFBQUssQ0FBQ3lGLEtBQUssQ0FBQ0QsSUFBSSxFQUFFRyxPQUFPLENBQUNBLE9BQU8sSUFBSUEsT0FBTyxDQUFDO0VBQy9ELElBQUlBLE9BQU8sWUFBWUYsS0FBSyxFQUFFO0lBQzVCSixLQUFLLENBQUNrRCxLQUFLLEdBQUc1QyxPQUFPLENBQUM0QyxLQUFLO0VBQzdCO0VBQ0EsT0FBT2xELEtBQUs7QUFDZDtBQUNPLFNBQVMzQyxpQkFBaUIsQ0FBQ0YsT0FBTyxFQUFFNUIsWUFBWSxFQUFFNkIsSUFBSSxFQUFFO0VBQzdELE1BQU0rRixZQUFZLEdBQUdsRixZQUFZLENBQUMxQyxZQUFZLEVBQUVaLGFBQUssQ0FBQ0osYUFBYSxDQUFDO0VBQ3BFLElBQUksQ0FBQzRJLFlBQVksRUFBRTtJQUNqQjtFQUNGO0VBQ0EsSUFBSSxPQUFPQSxZQUFZLEtBQUssUUFBUSxJQUFJQSxZQUFZLENBQUM3RixpQkFBaUIsSUFBSUgsT0FBTyxDQUFDcUIsTUFBTSxFQUFFO0lBQ3hGckIsT0FBTyxDQUFDRyxpQkFBaUIsR0FBRyxJQUFJO0VBQ2xDO0VBQ0EsT0FBTyxJQUFJOEQsT0FBTyxDQUFDLENBQUM3QixPQUFPLEVBQUVDLE1BQU0sS0FBSztJQUN0QyxPQUFPNEIsT0FBTyxDQUFDN0IsT0FBTyxFQUFFLENBQ3JCaUMsSUFBSSxDQUFDLE1BQU07TUFDVixPQUFPLE9BQU8yQixZQUFZLEtBQUssUUFBUSxHQUNuQ0MsdUJBQXVCLENBQUNELFlBQVksRUFBRWhHLE9BQU8sRUFBRUMsSUFBSSxDQUFDLEdBQ3BEK0YsWUFBWSxDQUFDaEcsT0FBTyxDQUFDO0lBQzNCLENBQUMsQ0FBQyxDQUNEcUUsSUFBSSxDQUFDLE1BQU07TUFDVmpDLE9BQU8sRUFBRTtJQUNYLENBQUMsQ0FBQyxDQUNEOEQsS0FBSyxDQUFDcEQsQ0FBQyxJQUFJO01BQ1YsTUFBTUQsS0FBSyxHQUFHRSxZQUFZLENBQUNELENBQUMsRUFBRTtRQUM1QkUsSUFBSSxFQUFFeEYsYUFBSyxDQUFDeUYsS0FBSyxDQUFDa0QsZ0JBQWdCO1FBQ2xDaEQsT0FBTyxFQUFFO01BQ1gsQ0FBQyxDQUFDO01BQ0ZkLE1BQU0sQ0FBQ1EsS0FBSyxDQUFDO0lBQ2YsQ0FBQyxDQUFDO0VBQ04sQ0FBQyxDQUFDO0FBQ0o7QUFDQSxlQUFlb0QsdUJBQXVCLENBQUNHLE9BQU8sRUFBRXBHLE9BQU8sRUFBRUMsSUFBSSxFQUFFO0VBQzdELElBQUlELE9BQU8sQ0FBQ3FCLE1BQU0sSUFBSSxDQUFDK0UsT0FBTyxDQUFDQyxpQkFBaUIsRUFBRTtJQUNoRDtFQUNGO0VBQ0EsSUFBSUMsT0FBTyxHQUFHdEcsT0FBTyxDQUFDNkIsSUFBSTtFQUMxQixJQUNFLENBQUN5RSxPQUFPLElBQ1J0RyxPQUFPLENBQUNkLE1BQU0sSUFDZGMsT0FBTyxDQUFDZCxNQUFNLENBQUN2QyxTQUFTLEtBQUssT0FBTyxJQUNwQyxDQUFDcUQsT0FBTyxDQUFDZCxNQUFNLENBQUNxSCxPQUFPLEVBQUUsRUFDekI7SUFDQUQsT0FBTyxHQUFHdEcsT0FBTyxDQUFDZCxNQUFNO0VBQzFCO0VBQ0EsSUFDRSxDQUFDa0gsT0FBTyxDQUFDSSxXQUFXLElBQUlKLE9BQU8sQ0FBQ0ssbUJBQW1CLElBQUlMLE9BQU8sQ0FBQ00sbUJBQW1CLEtBQ2xGLENBQUNKLE9BQU8sRUFDUjtJQUNBLE1BQU0sOENBQThDO0VBQ3REO0VBQ0EsSUFBSUYsT0FBTyxDQUFDTyxhQUFhLElBQUksQ0FBQzNHLE9BQU8sQ0FBQ3FCLE1BQU0sRUFBRTtJQUM1QyxNQUFNLHFFQUFxRTtFQUM3RTtFQUNBLElBQUl1RixNQUFNLEdBQUc1RyxPQUFPLENBQUM0RyxNQUFNLElBQUksQ0FBQyxDQUFDO0VBQ2pDLElBQUk1RyxPQUFPLENBQUNkLE1BQU0sRUFBRTtJQUNsQjBILE1BQU0sR0FBRzVHLE9BQU8sQ0FBQ2QsTUFBTSxDQUFDQyxNQUFNLEVBQUU7RUFDbEM7RUFDQSxNQUFNMEgsYUFBYSxHQUFHMUssR0FBRyxJQUFJO0lBQzNCLE1BQU11RSxLQUFLLEdBQUdrRyxNQUFNLENBQUN6SyxHQUFHLENBQUM7SUFDekIsSUFBSXVFLEtBQUssSUFBSSxJQUFJLEVBQUU7TUFDakIsTUFBTyw4Q0FBNkN2RSxHQUFJLEdBQUU7SUFDNUQ7RUFDRixDQUFDO0VBRUQsTUFBTTJLLGVBQWUsR0FBRyxPQUFPQyxHQUFHLEVBQUU1SyxHQUFHLEVBQUV1RCxHQUFHLEtBQUs7SUFDL0MsSUFBSXNILElBQUksR0FBR0QsR0FBRyxDQUFDWCxPQUFPO0lBQ3RCLElBQUksT0FBT1ksSUFBSSxLQUFLLFVBQVUsRUFBRTtNQUM5QixJQUFJO1FBQ0YsTUFBTW5ELE1BQU0sR0FBRyxNQUFNbUQsSUFBSSxDQUFDdEgsR0FBRyxDQUFDO1FBQzlCLElBQUksQ0FBQ21FLE1BQU0sSUFBSUEsTUFBTSxJQUFJLElBQUksRUFBRTtVQUM3QixNQUFNa0QsR0FBRyxDQUFDbEUsS0FBSyxJQUFLLHdDQUF1QzFHLEdBQUksR0FBRTtRQUNuRTtNQUNGLENBQUMsQ0FBQyxPQUFPMkcsQ0FBQyxFQUFFO1FBQ1YsSUFBSSxDQUFDQSxDQUFDLEVBQUU7VUFDTixNQUFNaUUsR0FBRyxDQUFDbEUsS0FBSyxJQUFLLHdDQUF1QzFHLEdBQUksR0FBRTtRQUNuRTtRQUVBLE1BQU00SyxHQUFHLENBQUNsRSxLQUFLLElBQUlDLENBQUMsQ0FBQ0ssT0FBTyxJQUFJTCxDQUFDO01BQ25DO01BQ0E7SUFDRjtJQUNBLElBQUksQ0FBQ21FLEtBQUssQ0FBQ0MsT0FBTyxDQUFDRixJQUFJLENBQUMsRUFBRTtNQUN4QkEsSUFBSSxHQUFHLENBQUNELEdBQUcsQ0FBQ1gsT0FBTyxDQUFDO0lBQ3RCO0lBRUEsSUFBSSxDQUFDWSxJQUFJLENBQUNHLFFBQVEsQ0FBQ3pILEdBQUcsQ0FBQyxFQUFFO01BQ3ZCLE1BQ0VxSCxHQUFHLENBQUNsRSxLQUFLLElBQUsseUNBQXdDMUcsR0FBSSxlQUFjNkssSUFBSSxDQUFDSSxJQUFJLENBQUMsSUFBSSxDQUFFLEVBQUM7SUFFN0Y7RUFDRixDQUFDO0VBRUQsTUFBTUMsT0FBTyxHQUFHQyxFQUFFLElBQUk7SUFDcEIsTUFBTUMsS0FBSyxHQUFHRCxFQUFFLElBQUlBLEVBQUUsQ0FBQ0UsUUFBUSxFQUFFLENBQUNELEtBQUssQ0FBQyxvQkFBb0IsQ0FBQztJQUM3RCxPQUFPLENBQUNBLEtBQUssR0FBR0EsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRUUsV0FBVyxFQUFFO0VBQzlDLENBQUM7RUFDRCxJQUFJUixLQUFLLENBQUNDLE9BQU8sQ0FBQ2QsT0FBTyxDQUFDc0IsTUFBTSxDQUFDLEVBQUU7SUFDakMsS0FBSyxNQUFNdkwsR0FBRyxJQUFJaUssT0FBTyxDQUFDc0IsTUFBTSxFQUFFO01BQ2hDYixhQUFhLENBQUMxSyxHQUFHLENBQUM7SUFDcEI7RUFDRixDQUFDLE1BQU07SUFDTCxNQUFNd0wsY0FBYyxHQUFHLEVBQUU7SUFDekIsS0FBSyxNQUFNeEwsR0FBRyxJQUFJaUssT0FBTyxDQUFDc0IsTUFBTSxFQUFFO01BQ2hDLE1BQU1YLEdBQUcsR0FBR1gsT0FBTyxDQUFDc0IsTUFBTSxDQUFDdkwsR0FBRyxDQUFDO01BQy9CLElBQUl1RCxHQUFHLEdBQUdrSCxNQUFNLENBQUN6SyxHQUFHLENBQUM7TUFDckIsSUFBSSxPQUFPNEssR0FBRyxLQUFLLFFBQVEsRUFBRTtRQUMzQkYsYUFBYSxDQUFDRSxHQUFHLENBQUM7TUFDcEI7TUFDQSxJQUFJLE9BQU9BLEdBQUcsS0FBSyxRQUFRLEVBQUU7UUFDM0IsSUFBSUEsR0FBRyxDQUFDYSxPQUFPLElBQUksSUFBSSxJQUFJbEksR0FBRyxJQUFJLElBQUksRUFBRTtVQUN0Q0EsR0FBRyxHQUFHcUgsR0FBRyxDQUFDYSxPQUFPO1VBQ2pCaEIsTUFBTSxDQUFDekssR0FBRyxDQUFDLEdBQUd1RCxHQUFHO1VBQ2pCLElBQUlNLE9BQU8sQ0FBQ2QsTUFBTSxFQUFFO1lBQ2xCYyxPQUFPLENBQUNkLE1BQU0sQ0FBQzJJLEdBQUcsQ0FBQzFMLEdBQUcsRUFBRXVELEdBQUcsQ0FBQztVQUM5QjtRQUNGO1FBQ0EsSUFBSXFILEdBQUcsQ0FBQ2UsUUFBUSxJQUFJOUgsT0FBTyxDQUFDZCxNQUFNLEVBQUU7VUFDbEMsSUFBSWMsT0FBTyxDQUFDMEIsUUFBUSxFQUFFO1lBQ3BCMUIsT0FBTyxDQUFDZCxNQUFNLENBQUM2SSxNQUFNLENBQUM1TCxHQUFHLENBQUM7VUFDNUIsQ0FBQyxNQUFNLElBQUk0SyxHQUFHLENBQUNhLE9BQU8sSUFBSSxJQUFJLEVBQUU7WUFDOUI1SCxPQUFPLENBQUNkLE1BQU0sQ0FBQzJJLEdBQUcsQ0FBQzFMLEdBQUcsRUFBRTRLLEdBQUcsQ0FBQ2EsT0FBTyxDQUFDO1VBQ3RDO1FBQ0Y7UUFDQSxJQUFJYixHQUFHLENBQUNpQixRQUFRLEVBQUU7VUFDaEJuQixhQUFhLENBQUMxSyxHQUFHLENBQUM7UUFDcEI7UUFDQSxNQUFNOEwsUUFBUSxHQUFHLENBQUNsQixHQUFHLENBQUNpQixRQUFRLElBQUl0SSxHQUFHLEtBQUsvQixTQUFTO1FBQ25ELElBQUksQ0FBQ3NLLFFBQVEsRUFBRTtVQUNiLElBQUlsQixHQUFHLENBQUNoSyxJQUFJLEVBQUU7WUFDWixNQUFNQSxJQUFJLEdBQUdzSyxPQUFPLENBQUNOLEdBQUcsQ0FBQ2hLLElBQUksQ0FBQztZQUM5QixNQUFNbUwsT0FBTyxHQUFHakIsS0FBSyxDQUFDQyxPQUFPLENBQUN4SCxHQUFHLENBQUMsR0FBRyxPQUFPLEdBQUcsT0FBT0EsR0FBRztZQUN6RCxJQUFJd0ksT0FBTyxLQUFLbkwsSUFBSSxFQUFFO2NBQ3BCLE1BQU8sdUNBQXNDWixHQUFJLGVBQWNZLElBQUssRUFBQztZQUN2RTtVQUNGO1VBQ0EsSUFBSWdLLEdBQUcsQ0FBQ1gsT0FBTyxFQUFFO1lBQ2Z1QixjQUFjLENBQUNoSixJQUFJLENBQUNtSSxlQUFlLENBQUNDLEdBQUcsRUFBRTVLLEdBQUcsRUFBRXVELEdBQUcsQ0FBQyxDQUFDO1VBQ3JEO1FBQ0Y7TUFDRjtJQUNGO0lBQ0EsTUFBTXVFLE9BQU8sQ0FBQ2tFLEdBQUcsQ0FBQ1IsY0FBYyxDQUFDO0VBQ25DO0VBQ0EsSUFBSVMsU0FBUyxHQUFHaEMsT0FBTyxDQUFDSyxtQkFBbUI7RUFDM0MsSUFBSTRCLGVBQWUsR0FBR2pDLE9BQU8sQ0FBQ00sbUJBQW1CO0VBQ2pELE1BQU00QixRQUFRLEdBQUcsQ0FBQ3JFLE9BQU8sQ0FBQzdCLE9BQU8sRUFBRSxFQUFFNkIsT0FBTyxDQUFDN0IsT0FBTyxFQUFFLEVBQUU2QixPQUFPLENBQUM3QixPQUFPLEVBQUUsQ0FBQztFQUMxRSxJQUFJZ0csU0FBUyxJQUFJQyxlQUFlLEVBQUU7SUFDaENDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBR3JJLElBQUksQ0FBQ3NJLFlBQVksRUFBRTtFQUNuQztFQUNBLElBQUksT0FBT0gsU0FBUyxLQUFLLFVBQVUsRUFBRTtJQUNuQ0UsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHRixTQUFTLEVBQUU7RUFDM0I7RUFDQSxJQUFJLE9BQU9DLGVBQWUsS0FBSyxVQUFVLEVBQUU7SUFDekNDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBR0QsZUFBZSxFQUFFO0VBQ2pDO0VBQ0EsTUFBTSxDQUFDRyxLQUFLLEVBQUVDLGlCQUFpQixFQUFFQyxrQkFBa0IsQ0FBQyxHQUFHLE1BQU16RSxPQUFPLENBQUNrRSxHQUFHLENBQUNHLFFBQVEsQ0FBQztFQUNsRixJQUFJRyxpQkFBaUIsSUFBSXhCLEtBQUssQ0FBQ0MsT0FBTyxDQUFDdUIsaUJBQWlCLENBQUMsRUFBRTtJQUN6REwsU0FBUyxHQUFHSyxpQkFBaUI7RUFDL0I7RUFDQSxJQUFJQyxrQkFBa0IsSUFBSXpCLEtBQUssQ0FBQ0MsT0FBTyxDQUFDd0Isa0JBQWtCLENBQUMsRUFBRTtJQUMzREwsZUFBZSxHQUFHSyxrQkFBa0I7RUFDdEM7RUFDQSxJQUFJTixTQUFTLEVBQUU7SUFDYixNQUFNTyxPQUFPLEdBQUdQLFNBQVMsQ0FBQ1EsSUFBSSxDQUFDQyxZQUFZLElBQUlMLEtBQUssQ0FBQ3JCLFFBQVEsQ0FBRSxRQUFPMEIsWUFBYSxFQUFDLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUNGLE9BQU8sRUFBRTtNQUNaLE1BQU8sNERBQTJEO0lBQ3BFO0VBQ0Y7RUFDQSxJQUFJTixlQUFlLEVBQUU7SUFDbkIsS0FBSyxNQUFNUSxZQUFZLElBQUlSLGVBQWUsRUFBRTtNQUMxQyxJQUFJLENBQUNHLEtBQUssQ0FBQ3JCLFFBQVEsQ0FBRSxRQUFPMEIsWUFBYSxFQUFDLENBQUMsRUFBRTtRQUMzQyxNQUFPLGdFQUErRDtNQUN4RTtJQUNGO0VBQ0Y7RUFDQSxNQUFNQyxRQUFRLEdBQUcxQyxPQUFPLENBQUMyQyxlQUFlLElBQUksRUFBRTtFQUM5QyxJQUFJOUIsS0FBSyxDQUFDQyxPQUFPLENBQUM0QixRQUFRLENBQUMsRUFBRTtJQUMzQixLQUFLLE1BQU0zTSxHQUFHLElBQUkyTSxRQUFRLEVBQUU7TUFDMUIsSUFBSSxDQUFDeEMsT0FBTyxFQUFFO1FBQ1osTUFBTSxvQ0FBb0M7TUFDNUM7TUFFQSxJQUFJQSxPQUFPLENBQUNwSSxHQUFHLENBQUMvQixHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUU7UUFDNUIsTUFBTywwQ0FBeUNBLEdBQUksbUJBQWtCO01BQ3hFO0lBQ0Y7RUFDRixDQUFDLE1BQU0sSUFBSSxPQUFPMk0sUUFBUSxLQUFLLFFBQVEsRUFBRTtJQUN2QyxNQUFNbkIsY0FBYyxHQUFHLEVBQUU7SUFDekIsS0FBSyxNQUFNeEwsR0FBRyxJQUFJaUssT0FBTyxDQUFDMkMsZUFBZSxFQUFFO01BQ3pDLE1BQU1oQyxHQUFHLEdBQUdYLE9BQU8sQ0FBQzJDLGVBQWUsQ0FBQzVNLEdBQUcsQ0FBQztNQUN4QyxJQUFJNEssR0FBRyxDQUFDWCxPQUFPLEVBQUU7UUFDZnVCLGNBQWMsQ0FBQ2hKLElBQUksQ0FBQ21JLGVBQWUsQ0FBQ0MsR0FBRyxFQUFFNUssR0FBRyxFQUFFbUssT0FBTyxDQUFDcEksR0FBRyxDQUFDL0IsR0FBRyxDQUFDLENBQUMsQ0FBQztNQUNsRTtJQUNGO0lBQ0EsTUFBTThILE9BQU8sQ0FBQ2tFLEdBQUcsQ0FBQ1IsY0FBYyxDQUFDO0VBQ25DO0FBQ0Y7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNxQixlQUFlLENBQzdCbkosV0FBVyxFQUNYSSxJQUFJLEVBQ0plLFdBQVcsRUFDWEMsbUJBQW1CLEVBQ25CQyxNQUFNLEVBQ05DLE9BQU8sRUFDUDtFQUNBLElBQUksQ0FBQ0gsV0FBVyxFQUFFO0lBQ2hCLE9BQU9pRCxPQUFPLENBQUM3QixPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDNUI7RUFDQSxPQUFPLElBQUk2QixPQUFPLENBQUMsVUFBVTdCLE9BQU8sRUFBRUMsTUFBTSxFQUFFO0lBQzVDLElBQUl0QyxPQUFPLEdBQUdILFVBQVUsQ0FBQ29CLFdBQVcsQ0FBQ3JFLFNBQVMsRUFBRWtELFdBQVcsRUFBRXFCLE1BQU0sQ0FBQzlELGFBQWEsQ0FBQztJQUNsRixJQUFJLENBQUMyQyxPQUFPLEVBQUUsT0FBT3FDLE9BQU8sRUFBRTtJQUM5QixJQUFJcEMsT0FBTyxHQUFHZSxnQkFBZ0IsQ0FDNUJsQixXQUFXLEVBQ1hJLElBQUksRUFDSmUsV0FBVyxFQUNYQyxtQkFBbUIsRUFDbkJDLE1BQU0sRUFDTkMsT0FBTyxDQUNSO0lBQ0QsSUFBSTtNQUFFbUIsT0FBTztNQUFFTztJQUFNLENBQUMsR0FBR1YsaUJBQWlCLENBQ3hDbkMsT0FBTyxFQUNQZCxNQUFNLElBQUk7TUFDUjBFLDJCQUEyQixDQUN6Qi9ELFdBQVcsRUFDWG1CLFdBQVcsQ0FBQ3JFLFNBQVMsRUFDckJxRSxXQUFXLENBQUM3QixNQUFNLEVBQUUsRUFDcEJELE1BQU0sRUFDTmUsSUFBSSxFQUNKSixXQUFXLENBQUNvSixVQUFVLENBQUMsT0FBTyxDQUFDLEdBQzNCL0gsTUFBTSxDQUFDZ0QsU0FBUyxDQUFDSyxZQUFZLEdBQzdCckQsTUFBTSxDQUFDZ0QsU0FBUyxDQUFDQyxvQkFBb0IsQ0FDMUM7TUFDRCxJQUNFdEUsV0FBVyxLQUFLOUUsS0FBSyxDQUFDSSxVQUFVLElBQ2hDMEUsV0FBVyxLQUFLOUUsS0FBSyxDQUFDSyxTQUFTLElBQy9CeUUsV0FBVyxLQUFLOUUsS0FBSyxDQUFDTSxZQUFZLElBQ2xDd0UsV0FBVyxLQUFLOUUsS0FBSyxDQUFDTyxXQUFXLEVBQ2pDO1FBQ0FTLE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQ1IsT0FBTyxFQUFFbkIsT0FBTyxDQUFDbUIsT0FBTyxDQUFDO01BQ3pDO01BQ0FpQixPQUFPLENBQUNsRCxNQUFNLENBQUM7SUFDakIsQ0FBQyxFQUNEMkQsS0FBSyxJQUFJO01BQ1BrQix5QkFBeUIsQ0FDdkJsRSxXQUFXLEVBQ1htQixXQUFXLENBQUNyRSxTQUFTLEVBQ3JCcUUsV0FBVyxDQUFDN0IsTUFBTSxFQUFFLEVBQ3BCYyxJQUFJLEVBQ0o0QyxLQUFLLEVBQ0wzQixNQUFNLENBQUNnRCxTQUFTLENBQUNnRixrQkFBa0IsQ0FDcEM7TUFDRDdHLE1BQU0sQ0FBQ1EsS0FBSyxDQUFDO0lBQ2YsQ0FBQyxDQUNGOztJQUVEO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxPQUFPb0IsT0FBTyxDQUFDN0IsT0FBTyxFQUFFLENBQ3JCaUMsSUFBSSxDQUFDLE1BQU07TUFDVixPQUFPbkUsaUJBQWlCLENBQUNGLE9BQU8sRUFBRyxHQUFFSCxXQUFZLElBQUdtQixXQUFXLENBQUNyRSxTQUFVLEVBQUMsRUFBRXNELElBQUksQ0FBQztJQUNwRixDQUFDLENBQUMsQ0FDRG9FLElBQUksQ0FBQyxNQUFNO01BQ1YsSUFBSXJFLE9BQU8sQ0FBQ0csaUJBQWlCLEVBQUU7UUFDN0IsT0FBTzhELE9BQU8sQ0FBQzdCLE9BQU8sRUFBRTtNQUMxQjtNQUNBLE1BQU0rRyxPQUFPLEdBQUdwSixPQUFPLENBQUNDLE9BQU8sQ0FBQztNQUNoQyxJQUNFSCxXQUFXLEtBQUs5RSxLQUFLLENBQUNLLFNBQVMsSUFDL0J5RSxXQUFXLEtBQUs5RSxLQUFLLENBQUNPLFdBQVcsSUFDakN1RSxXQUFXLEtBQUs5RSxLQUFLLENBQUNFLFVBQVUsRUFDaEM7UUFDQW9JLG1CQUFtQixDQUNqQnhELFdBQVcsRUFDWG1CLFdBQVcsQ0FBQ3JFLFNBQVMsRUFDckJxRSxXQUFXLENBQUM3QixNQUFNLEVBQUUsRUFDcEJjLElBQUksRUFDSmlCLE1BQU0sQ0FBQ2dELFNBQVMsQ0FBQ0ssWUFBWSxDQUM5QjtNQUNIO01BQ0E7TUFDQSxJQUFJMUUsV0FBVyxLQUFLOUUsS0FBSyxDQUFDSSxVQUFVLEVBQUU7UUFDcEMsSUFBSWdPLE9BQU8sSUFBSSxPQUFPQSxPQUFPLENBQUM5RSxJQUFJLEtBQUssVUFBVSxFQUFFO1VBQ2pELE9BQU84RSxPQUFPLENBQUM5RSxJQUFJLENBQUM5QixRQUFRLElBQUk7WUFDOUI7WUFDQSxJQUFJQSxRQUFRLElBQUlBLFFBQVEsQ0FBQ3JELE1BQU0sRUFBRTtjQUMvQixPQUFPcUQsUUFBUTtZQUNqQjtZQUNBLE9BQU8sSUFBSTtVQUNiLENBQUMsQ0FBQztRQUNKO1FBQ0EsT0FBTyxJQUFJO01BQ2I7TUFFQSxPQUFPNEcsT0FBTztJQUNoQixDQUFDLENBQUMsQ0FDRDlFLElBQUksQ0FBQy9CLE9BQU8sRUFBRU8sS0FBSyxDQUFDO0VBQ3pCLENBQUMsQ0FBQztBQUNKOztBQUVBO0FBQ0E7QUFDTyxTQUFTdUcsT0FBTyxDQUFDQyxJQUFJLEVBQUVDLFVBQVUsRUFBRTtFQUN4QyxJQUFJQyxJQUFJLEdBQUcsT0FBT0YsSUFBSSxJQUFJLFFBQVEsR0FBR0EsSUFBSSxHQUFHO0lBQUUxTSxTQUFTLEVBQUUwTTtFQUFLLENBQUM7RUFDL0QsS0FBSyxJQUFJbE4sR0FBRyxJQUFJbU4sVUFBVSxFQUFFO0lBQzFCQyxJQUFJLENBQUNwTixHQUFHLENBQUMsR0FBR21OLFVBQVUsQ0FBQ25OLEdBQUcsQ0FBQztFQUM3QjtFQUNBLE9BQU9xQixhQUFLLENBQUN6QixNQUFNLENBQUNxSSxRQUFRLENBQUNtRixJQUFJLENBQUM7QUFDcEM7QUFFTyxTQUFTQyx5QkFBeUIsQ0FBQ0gsSUFBSSxFQUFFak0sYUFBYSxHQUFHSSxhQUFLLENBQUNKLGFBQWEsRUFBRTtFQUNuRixJQUFJLENBQUNKLGFBQWEsSUFBSSxDQUFDQSxhQUFhLENBQUNJLGFBQWEsQ0FBQyxJQUFJLENBQUNKLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNkLFNBQVMsRUFBRTtJQUM5RjtFQUNGO0VBQ0FVLGFBQWEsQ0FBQ0ksYUFBYSxDQUFDLENBQUNkLFNBQVMsQ0FBQ3lDLE9BQU8sQ0FBQ2xCLE9BQU8sSUFBSUEsT0FBTyxDQUFDd0wsSUFBSSxDQUFDLENBQUM7QUFDMUU7QUFFTyxTQUFTSSxvQkFBb0IsQ0FBQzVKLFdBQVcsRUFBRUksSUFBSSxFQUFFeUosVUFBVSxFQUFFeEksTUFBTSxFQUFFO0VBQzFFLE1BQU1sQixPQUFPLG1DQUNSMEosVUFBVTtJQUNidEksV0FBVyxFQUFFdkIsV0FBVztJQUN4QndCLE1BQU0sRUFBRSxLQUFLO0lBQ2JDLEdBQUcsRUFBRUosTUFBTSxDQUFDSyxnQkFBZ0I7SUFDNUJDLE9BQU8sRUFBRU4sTUFBTSxDQUFDTSxPQUFPO0lBQ3ZCQyxFQUFFLEVBQUVQLE1BQU0sQ0FBQ087RUFBRSxFQUNkO0VBRUQsSUFBSSxDQUFDeEIsSUFBSSxFQUFFO0lBQ1QsT0FBT0QsT0FBTztFQUNoQjtFQUNBLElBQUlDLElBQUksQ0FBQzJCLFFBQVEsRUFBRTtJQUNqQjVCLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJO0VBQzFCO0VBQ0EsSUFBSUMsSUFBSSxDQUFDNEIsSUFBSSxFQUFFO0lBQ2I3QixPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUdDLElBQUksQ0FBQzRCLElBQUk7RUFDN0I7RUFDQSxJQUFJNUIsSUFBSSxDQUFDNkIsY0FBYyxFQUFFO0lBQ3ZCOUIsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUdDLElBQUksQ0FBQzZCLGNBQWM7RUFDakQ7RUFDQSxPQUFPOUIsT0FBTztBQUNoQjtBQUVPLGVBQWUySixtQkFBbUIsQ0FBQzlKLFdBQVcsRUFBRTZKLFVBQVUsRUFBRXhJLE1BQU0sRUFBRWpCLElBQUksRUFBRTtFQUMvRSxNQUFNMkosYUFBYSxHQUFHbk4sWUFBWSxDQUFDZSxhQUFLLENBQUNxTSxJQUFJLENBQUM7RUFDOUMsTUFBTUMsV0FBVyxHQUFHbEssVUFBVSxDQUFDZ0ssYUFBYSxFQUFFL0osV0FBVyxFQUFFcUIsTUFBTSxDQUFDOUQsYUFBYSxDQUFDO0VBQ2hGLElBQUksT0FBTzBNLFdBQVcsS0FBSyxVQUFVLEVBQUU7SUFDckMsSUFBSTtNQUNGLE1BQU05SixPQUFPLEdBQUd5SixvQkFBb0IsQ0FBQzVKLFdBQVcsRUFBRUksSUFBSSxFQUFFeUosVUFBVSxFQUFFeEksTUFBTSxDQUFDO01BQzNFLE1BQU1oQixpQkFBaUIsQ0FBQ0YsT0FBTyxFQUFHLEdBQUVILFdBQVksSUFBRytKLGFBQWMsRUFBQyxFQUFFM0osSUFBSSxDQUFDO01BQ3pFLElBQUlELE9BQU8sQ0FBQ0csaUJBQWlCLEVBQUU7UUFDN0IsT0FBT3VKLFVBQVU7TUFDbkI7TUFDQSxNQUFNN0YsTUFBTSxHQUFHLE1BQU1pRyxXQUFXLENBQUM5SixPQUFPLENBQUM7TUFDekM0RCwyQkFBMkIsQ0FDekIvRCxXQUFXLEVBQ1gsWUFBWSxrQ0FDUDZKLFVBQVUsQ0FBQ0ssSUFBSSxDQUFDNUssTUFBTSxFQUFFO1FBQUU2SyxRQUFRLEVBQUVOLFVBQVUsQ0FBQ007TUFBUSxJQUM1RG5HLE1BQU0sRUFDTjVELElBQUksRUFDSmlCLE1BQU0sQ0FBQ2dELFNBQVMsQ0FBQ0Msb0JBQW9CLENBQ3RDO01BQ0QsT0FBT04sTUFBTSxJQUFJNkYsVUFBVTtJQUM3QixDQUFDLENBQUMsT0FBTzdHLEtBQUssRUFBRTtNQUNka0IseUJBQXlCLENBQ3ZCbEUsV0FBVyxFQUNYLFlBQVksa0NBQ1A2SixVQUFVLENBQUNLLElBQUksQ0FBQzVLLE1BQU0sRUFBRTtRQUFFNkssUUFBUSxFQUFFTixVQUFVLENBQUNNO01BQVEsSUFDNUQvSixJQUFJLEVBQ0o0QyxLQUFLLEVBQ0wzQixNQUFNLENBQUNnRCxTQUFTLENBQUNnRixrQkFBa0IsQ0FDcEM7TUFDRCxNQUFNckcsS0FBSztJQUNiO0VBQ0Y7RUFDQSxPQUFPNkcsVUFBVTtBQUNuQiJ9