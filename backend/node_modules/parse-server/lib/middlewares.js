"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addRateLimit = exports.DEFAULT_ALLOWED_HEADERS = void 0;
exports.allowCrossDomain = allowCrossDomain;
exports.allowMethodOverride = allowMethodOverride;
exports.enforceMasterKeyAccess = enforceMasterKeyAccess;
exports.handleParseErrors = handleParseErrors;
exports.handleParseHeaders = handleParseHeaders;
exports.handleParseSession = void 0;
exports.promiseEnforceMasterKeyAccess = promiseEnforceMasterKeyAccess;
exports.promiseEnsureIdempotency = promiseEnsureIdempotency;
var _cache = _interopRequireDefault(require("./cache"));
var _node = _interopRequireDefault(require("parse/node"));
var _Auth = _interopRequireDefault(require("./Auth"));
var _Config = _interopRequireDefault(require("./Config"));
var _ClientSDK = _interopRequireDefault(require("./ClientSDK"));
var _logger = _interopRequireDefault(require("./logger"));
var _rest = _interopRequireDefault(require("./rest"));
var _MongoStorageAdapter = _interopRequireDefault(require("./Adapters/Storage/Mongo/MongoStorageAdapter"));
var _PostgresStorageAdapter = _interopRequireDefault(require("./Adapters/Storage/Postgres/PostgresStorageAdapter"));
var _expressRateLimit = _interopRequireDefault(require("express-rate-limit"));
var _Definitions = require("./Options/Definitions");
var _pathToRegexp = require("path-to-regexp");
var _ipRangeCheck = _interopRequireDefault(require("ip-range-check"));
var _rateLimitRedis = _interopRequireDefault(require("rate-limit-redis"));
var _redis = require("redis");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const DEFAULT_ALLOWED_HEADERS = 'X-Parse-Master-Key, X-Parse-REST-API-Key, X-Parse-Javascript-Key, X-Parse-Application-Id, X-Parse-Client-Version, X-Parse-Session-Token, X-Requested-With, X-Parse-Revocable-Session, X-Parse-Request-Id, Content-Type, Pragma, Cache-Control';
exports.DEFAULT_ALLOWED_HEADERS = DEFAULT_ALLOWED_HEADERS;
const getMountForRequest = function (req) {
  const mountPathLength = req.originalUrl.length - req.url.length;
  const mountPath = req.originalUrl.slice(0, mountPathLength);
  return req.protocol + '://' + req.get('host') + mountPath;
};

// Checks that the request is authorized for this app and checks user
// auth too.
// The bodyparser should run before this middleware.
// Adds info to the request:
// req.config - the Config for this app
// req.auth - the Auth for this request
function handleParseHeaders(req, res, next) {
  var mount = getMountForRequest(req);
  let context = {};
  if (req.get('X-Parse-Cloud-Context') != null) {
    try {
      context = JSON.parse(req.get('X-Parse-Cloud-Context'));
      if (Object.prototype.toString.call(context) !== '[object Object]') {
        throw 'Context is not an object';
      }
    } catch (e) {
      return malformedContext(req, res);
    }
  }
  var info = {
    appId: req.get('X-Parse-Application-Id'),
    sessionToken: req.get('X-Parse-Session-Token'),
    masterKey: req.get('X-Parse-Master-Key'),
    maintenanceKey: req.get('X-Parse-Maintenance-Key'),
    installationId: req.get('X-Parse-Installation-Id'),
    clientKey: req.get('X-Parse-Client-Key'),
    javascriptKey: req.get('X-Parse-Javascript-Key'),
    dotNetKey: req.get('X-Parse-Windows-Key'),
    restAPIKey: req.get('X-Parse-REST-API-Key'),
    clientVersion: req.get('X-Parse-Client-Version'),
    context: context
  };
  var basicAuth = httpAuth(req);
  if (basicAuth) {
    var basicAuthAppId = basicAuth.appId;
    if (_cache.default.get(basicAuthAppId)) {
      info.appId = basicAuthAppId;
      info.masterKey = basicAuth.masterKey || info.masterKey;
      info.javascriptKey = basicAuth.javascriptKey || info.javascriptKey;
    }
  }
  if (req.body) {
    // Unity SDK sends a _noBody key which needs to be removed.
    // Unclear at this point if action needs to be taken.
    delete req.body._noBody;
  }
  var fileViaJSON = false;
  if (!info.appId || !_cache.default.get(info.appId)) {
    // See if we can find the app id on the body.
    if (req.body instanceof Buffer) {
      // The only chance to find the app id is if this is a file
      // upload that actually is a JSON body. So try to parse it.
      // https://github.com/parse-community/parse-server/issues/6589
      // It is also possible that the client is trying to upload a file but forgot
      // to provide x-parse-app-id in header and parse a binary file will fail
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        return invalidRequest(req, res);
      }
      fileViaJSON = true;
    }
    if (req.body) {
      delete req.body._RevocableSession;
    }
    if (req.body && req.body._ApplicationId && _cache.default.get(req.body._ApplicationId) && (!info.masterKey || _cache.default.get(req.body._ApplicationId).masterKey === info.masterKey)) {
      info.appId = req.body._ApplicationId;
      info.javascriptKey = req.body._JavaScriptKey || '';
      delete req.body._ApplicationId;
      delete req.body._JavaScriptKey;
      // TODO: test that the REST API formats generated by the other
      // SDKs are handled ok
      if (req.body._ClientVersion) {
        info.clientVersion = req.body._ClientVersion;
        delete req.body._ClientVersion;
      }
      if (req.body._InstallationId) {
        info.installationId = req.body._InstallationId;
        delete req.body._InstallationId;
      }
      if (req.body._SessionToken) {
        info.sessionToken = req.body._SessionToken;
        delete req.body._SessionToken;
      }
      if (req.body._MasterKey) {
        info.masterKey = req.body._MasterKey;
        delete req.body._MasterKey;
      }
      if (req.body._context) {
        if (req.body._context instanceof Object) {
          info.context = req.body._context;
        } else {
          try {
            info.context = JSON.parse(req.body._context);
            if (Object.prototype.toString.call(info.context) !== '[object Object]') {
              throw 'Context is not an object';
            }
          } catch (e) {
            return malformedContext(req, res);
          }
        }
        delete req.body._context;
      }
      if (req.body._ContentType) {
        req.headers['content-type'] = req.body._ContentType;
        delete req.body._ContentType;
      }
    } else {
      return invalidRequest(req, res);
    }
  }
  if (info.sessionToken && typeof info.sessionToken !== 'string') {
    info.sessionToken = info.sessionToken.toString();
  }
  if (info.clientVersion) {
    info.clientSDK = _ClientSDK.default.fromString(info.clientVersion);
  }
  if (fileViaJSON) {
    req.fileData = req.body.fileData;
    // We need to repopulate req.body with a buffer
    var base64 = req.body.base64;
    req.body = Buffer.from(base64, 'base64');
  }
  const clientIp = getClientIp(req);
  const config = _Config.default.get(info.appId, mount);
  if (config.state && config.state !== 'ok') {
    res.status(500);
    res.json({
      code: _node.default.Error.INTERNAL_SERVER_ERROR,
      error: `Invalid server state: ${config.state}`
    });
    return;
  }
  info.app = _cache.default.get(info.appId);
  req.config = config;
  req.config.headers = req.headers || {};
  req.config.ip = clientIp;
  req.info = info;
  const isMaintenance = req.config.maintenanceKey && info.maintenanceKey === req.config.maintenanceKey;
  if (isMaintenance) {
    var _req$config;
    if ((0, _ipRangeCheck.default)(clientIp, req.config.maintenanceKeyIps || [])) {
      req.auth = new _Auth.default.Auth({
        config: req.config,
        installationId: info.installationId,
        isMaintenance: true
      });
      next();
      return;
    }
    const log = ((_req$config = req.config) === null || _req$config === void 0 ? void 0 : _req$config.loggerController) || _logger.default;
    log.error(`Request using maintenance key rejected as the request IP address '${clientIp}' is not set in Parse Server option 'maintenanceKeyIps'.`);
  }
  let isMaster = info.masterKey === req.config.masterKey;
  if (isMaster && !(0, _ipRangeCheck.default)(clientIp, req.config.masterKeyIps || [])) {
    var _req$config2;
    const log = ((_req$config2 = req.config) === null || _req$config2 === void 0 ? void 0 : _req$config2.loggerController) || _logger.default;
    log.error(`Request using master key rejected as the request IP address '${clientIp}' is not set in Parse Server option 'masterKeyIps'.`);
    isMaster = false;
  }
  if (isMaster) {
    req.auth = new _Auth.default.Auth({
      config: req.config,
      installationId: info.installationId,
      isMaster: true
    });
    return handleRateLimit(req, res, next);
  }
  var isReadOnlyMaster = info.masterKey === req.config.readOnlyMasterKey;
  if (typeof req.config.readOnlyMasterKey != 'undefined' && req.config.readOnlyMasterKey && isReadOnlyMaster) {
    req.auth = new _Auth.default.Auth({
      config: req.config,
      installationId: info.installationId,
      isMaster: true,
      isReadOnly: true
    });
    return handleRateLimit(req, res, next);
  }

  // Client keys are not required in parse-server, but if any have been configured in the server, validate them
  //  to preserve original behavior.
  const keys = ['clientKey', 'javascriptKey', 'dotNetKey', 'restAPIKey'];
  const oneKeyConfigured = keys.some(function (key) {
    return req.config[key] !== undefined;
  });
  const oneKeyMatches = keys.some(function (key) {
    return req.config[key] !== undefined && info[key] === req.config[key];
  });
  if (oneKeyConfigured && !oneKeyMatches) {
    return invalidRequest(req, res);
  }
  if (req.url == '/login') {
    delete info.sessionToken;
  }
  if (req.userFromJWT) {
    req.auth = new _Auth.default.Auth({
      config: req.config,
      installationId: info.installationId,
      isMaster: false,
      user: req.userFromJWT
    });
    return handleRateLimit(req, res, next);
  }
  if (!info.sessionToken) {
    req.auth = new _Auth.default.Auth({
      config: req.config,
      installationId: info.installationId,
      isMaster: false
    });
  }
  handleRateLimit(req, res, next);
}
const handleRateLimit = async (req, res, next) => {
  const rateLimits = req.config.rateLimits || [];
  try {
    await Promise.all(rateLimits.map(async limit => {
      const pathExp = new RegExp(limit.path);
      if (pathExp.test(req.url)) {
        await limit.handler(req, res, err => {
          if (err) {
            if (err.code === _node.default.Error.CONNECTION_FAILED) {
              throw err;
            }
            req.config.loggerController.error('An unknown error occured when attempting to apply the rate limiter: ', err);
          }
        });
      }
    }));
  } catch (error) {
    res.status(429);
    res.json({
      code: _node.default.Error.CONNECTION_FAILED,
      error: error.message
    });
    return;
  }
  next();
};
const handleParseSession = async (req, res, next) => {
  try {
    const info = req.info;
    if (req.auth) {
      next();
      return;
    }
    let requestAuth = null;
    if (info.sessionToken && req.url === '/upgradeToRevocableSession' && info.sessionToken.indexOf('r:') != 0) {
      requestAuth = await _Auth.default.getAuthForLegacySessionToken({
        config: req.config,
        installationId: info.installationId,
        sessionToken: info.sessionToken
      });
    } else {
      requestAuth = await _Auth.default.getAuthForSessionToken({
        config: req.config,
        installationId: info.installationId,
        sessionToken: info.sessionToken
      });
    }
    req.auth = requestAuth;
    next();
  } catch (error) {
    if (error instanceof _node.default.Error) {
      next(error);
      return;
    }
    // TODO: Determine the correct error scenario.
    req.config.loggerController.error('error getting auth for sessionToken', error);
    throw new _node.default.Error(_node.default.Error.UNKNOWN_ERROR, error);
  }
};
exports.handleParseSession = handleParseSession;
function getClientIp(req) {
  return req.ip;
}
function httpAuth(req) {
  if (!(req.req || req).headers.authorization) return;
  var header = (req.req || req).headers.authorization;
  var appId, masterKey, javascriptKey;

  // parse header
  var authPrefix = 'basic ';
  var match = header.toLowerCase().indexOf(authPrefix);
  if (match == 0) {
    var encodedAuth = header.substring(authPrefix.length, header.length);
    var credentials = decodeBase64(encodedAuth).split(':');
    if (credentials.length == 2) {
      appId = credentials[0];
      var key = credentials[1];
      var jsKeyPrefix = 'javascript-key=';
      var matchKey = key.indexOf(jsKeyPrefix);
      if (matchKey == 0) {
        javascriptKey = key.substring(jsKeyPrefix.length, key.length);
      } else {
        masterKey = key;
      }
    }
  }
  return {
    appId: appId,
    masterKey: masterKey,
    javascriptKey: javascriptKey
  };
}
function decodeBase64(str) {
  return Buffer.from(str, 'base64').toString();
}
function allowCrossDomain(appId) {
  return (req, res, next) => {
    const config = _Config.default.get(appId, getMountForRequest(req));
    let allowHeaders = DEFAULT_ALLOWED_HEADERS;
    if (config && config.allowHeaders) {
      allowHeaders += `, ${config.allowHeaders.join(', ')}`;
    }
    const baseOrigins = typeof (config === null || config === void 0 ? void 0 : config.allowOrigin) === 'string' ? [config.allowOrigin] : (config === null || config === void 0 ? void 0 : config.allowOrigin) ?? ['*'];
    const requestOrigin = req.headers.origin;
    const allowOrigins = requestOrigin && baseOrigins.includes(requestOrigin) ? requestOrigin : baseOrigins[0];
    res.header('Access-Control-Allow-Origin', allowOrigins);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', allowHeaders);
    res.header('Access-Control-Expose-Headers', 'X-Parse-Job-Status-Id, X-Parse-Push-Status-Id');
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.sendStatus(200);
    } else {
      next();
    }
  };
}
function allowMethodOverride(req, res, next) {
  if (req.method === 'POST' && req.body._method) {
    req.originalMethod = req.method;
    req.method = req.body._method;
    delete req.body._method;
  }
  next();
}
function handleParseErrors(err, req, res, next) {
  const log = req.config && req.config.loggerController || _logger.default;
  if (err instanceof _node.default.Error) {
    if (req.config && req.config.enableExpressErrorHandler) {
      return next(err);
    }
    let httpStatus;
    // TODO: fill out this mapping
    switch (err.code) {
      case _node.default.Error.INTERNAL_SERVER_ERROR:
        httpStatus = 500;
        break;
      case _node.default.Error.OBJECT_NOT_FOUND:
        httpStatus = 404;
        break;
      default:
        httpStatus = 400;
    }
    res.status(httpStatus);
    res.json({
      code: err.code,
      error: err.message
    });
    log.error('Parse error: ', err);
  } else if (err.status && err.message) {
    res.status(err.status);
    res.json({
      error: err.message
    });
    if (!(process && process.env.TESTING)) {
      next(err);
    }
  } else {
    log.error('Uncaught internal server error.', err, err.stack);
    res.status(500);
    res.json({
      code: _node.default.Error.INTERNAL_SERVER_ERROR,
      message: 'Internal server error.'
    });
    if (!(process && process.env.TESTING)) {
      next(err);
    }
  }
}
function enforceMasterKeyAccess(req, res, next) {
  if (!req.auth.isMaster) {
    res.status(403);
    res.end('{"error":"unauthorized: master key is required"}');
    return;
  }
  next();
}
function promiseEnforceMasterKeyAccess(request) {
  if (!request.auth.isMaster) {
    const error = new Error();
    error.status = 403;
    error.message = 'unauthorized: master key is required';
    throw error;
  }
  return Promise.resolve();
}
const addRateLimit = (route, config, cloud) => {
  if (typeof config === 'string') {
    config = _Config.default.get(config);
  }
  for (const key in route) {
    if (!_Definitions.RateLimitOptions[key]) {
      throw `Invalid rate limit option "${key}"`;
    }
  }
  if (!config.rateLimits) {
    config.rateLimits = [];
  }
  const redisStore = {
    connectionPromise: Promise.resolve(),
    store: null,
    connected: false
  };
  if (route.redisUrl) {
    const client = (0, _redis.createClient)({
      url: route.redisUrl
    });
    redisStore.connectionPromise = async () => {
      if (redisStore.connected) {
        return;
      }
      try {
        await client.connect();
        redisStore.connected = true;
      } catch (e) {
        var _config;
        const log = ((_config = config) === null || _config === void 0 ? void 0 : _config.loggerController) || _logger.default;
        log.error(`Could not connect to redisURL in rate limit: ${e}`);
      }
    };
    redisStore.connectionPromise();
    redisStore.store = new _rateLimitRedis.default({
      sendCommand: async (...args) => {
        await redisStore.connectionPromise();
        return client.sendCommand(args);
      }
    });
  }
  let transformPath = route.requestPath.split('/*').join('/(.*)');
  if (transformPath === '*') {
    transformPath = '(.*)';
  }
  config.rateLimits.push({
    path: (0, _pathToRegexp.pathToRegexp)(transformPath),
    handler: (0, _expressRateLimit.default)({
      windowMs: route.requestTimeWindow,
      max: route.requestCount,
      message: route.errorResponseMessage || _Definitions.RateLimitOptions.errorResponseMessage.default,
      handler: (request, response, next, options) => {
        throw {
          code: _node.default.Error.CONNECTION_FAILED,
          message: options.message
        };
      },
      skip: request => {
        var _request$auth;
        if (request.ip === '127.0.0.1' && !route.includeInternalRequests) {
          return true;
        }
        if (route.includeMasterKey) {
          return false;
        }
        if (route.requestMethods) {
          if (Array.isArray(route.requestMethods)) {
            if (!route.requestMethods.includes(request.method)) {
              return true;
            }
          } else {
            const regExp = new RegExp(route.requestMethods);
            if (!regExp.test(request.method)) {
              return true;
            }
          }
        }
        return (_request$auth = request.auth) === null || _request$auth === void 0 ? void 0 : _request$auth.isMaster;
      },
      keyGenerator: async request => {
        if (route.zone === _node.default.Server.RateLimitZone.global) {
          return request.config.appId;
        }
        const token = request.info.sessionToken;
        if (route.zone === _node.default.Server.RateLimitZone.session && token) {
          return token;
        }
        if (route.zone === _node.default.Server.RateLimitZone.user && token) {
          var _request$auth2, _request$auth2$user;
          if (!request.auth) {
            await new Promise(resolve => handleParseSession(request, null, resolve));
          }
          if ((_request$auth2 = request.auth) !== null && _request$auth2 !== void 0 && (_request$auth2$user = _request$auth2.user) !== null && _request$auth2$user !== void 0 && _request$auth2$user.id && request.zone === 'user') {
            return request.auth.user.id;
          }
        }
        return request.config.ip;
      },
      store: redisStore.store
    }),
    cloud
  });
  _Config.default.put(config);
};

/**
 * Deduplicates a request to ensure idempotency. Duplicates are determined by the request ID
 * in the request header. If a request has no request ID, it is executed anyway.
 * @param {*} req The request to evaluate.
 * @returns Promise<{}>
 */
exports.addRateLimit = addRateLimit;
function promiseEnsureIdempotency(req) {
  // Enable feature only for MongoDB
  if (!(req.config.database.adapter instanceof _MongoStorageAdapter.default || req.config.database.adapter instanceof _PostgresStorageAdapter.default)) {
    return Promise.resolve();
  }
  // Get parameters
  const config = req.config;
  const requestId = ((req || {}).headers || {})['x-parse-request-id'];
  const {
    paths,
    ttl
  } = config.idempotencyOptions;
  if (!requestId || !config.idempotencyOptions) {
    return Promise.resolve();
  }
  // Request path may contain trailing slashes, depending on the original request, so remove
  // leading and trailing slashes to make it easier to specify paths in the configuration
  const reqPath = req.path.replace(/^\/|\/$/, '');
  // Determine whether idempotency is enabled for current request path
  let match = false;
  for (const path of paths) {
    // Assume one wants a path to always match from the beginning to prevent any mistakes
    const regex = new RegExp(path.charAt(0) === '^' ? path : '^' + path);
    if (reqPath.match(regex)) {
      match = true;
      break;
    }
  }
  if (!match) {
    return Promise.resolve();
  }
  // Try to store request
  const expiryDate = new Date(new Date().setSeconds(new Date().getSeconds() + ttl));
  return _rest.default.create(config, _Auth.default.master(config), '_Idempotency', {
    reqId: requestId,
    expire: _node.default._encode(expiryDate)
  }).catch(e => {
    if (e.code == _node.default.Error.DUPLICATE_VALUE) {
      throw new _node.default.Error(_node.default.Error.DUPLICATE_REQUEST, 'Duplicate request');
    }
    throw e;
  });
}
function invalidRequest(req, res) {
  res.status(403);
  res.end('{"error":"unauthorized"}');
}
function malformedContext(req, res) {
  res.status(400);
  res.json({
    code: _node.default.Error.INVALID_JSON,
    error: 'Invalid object for context.'
  });
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJERUZBVUxUX0FMTE9XRURfSEVBREVSUyIsImdldE1vdW50Rm9yUmVxdWVzdCIsInJlcSIsIm1vdW50UGF0aExlbmd0aCIsIm9yaWdpbmFsVXJsIiwibGVuZ3RoIiwidXJsIiwibW91bnRQYXRoIiwic2xpY2UiLCJwcm90b2NvbCIsImdldCIsImhhbmRsZVBhcnNlSGVhZGVycyIsInJlcyIsIm5leHQiLCJtb3VudCIsImNvbnRleHQiLCJKU09OIiwicGFyc2UiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsImNhbGwiLCJlIiwibWFsZm9ybWVkQ29udGV4dCIsImluZm8iLCJhcHBJZCIsInNlc3Npb25Ub2tlbiIsIm1hc3RlcktleSIsIm1haW50ZW5hbmNlS2V5IiwiaW5zdGFsbGF0aW9uSWQiLCJjbGllbnRLZXkiLCJqYXZhc2NyaXB0S2V5IiwiZG90TmV0S2V5IiwicmVzdEFQSUtleSIsImNsaWVudFZlcnNpb24iLCJiYXNpY0F1dGgiLCJodHRwQXV0aCIsImJhc2ljQXV0aEFwcElkIiwiQXBwQ2FjaGUiLCJib2R5IiwiX25vQm9keSIsImZpbGVWaWFKU09OIiwiQnVmZmVyIiwiaW52YWxpZFJlcXVlc3QiLCJfUmV2b2NhYmxlU2Vzc2lvbiIsIl9BcHBsaWNhdGlvbklkIiwiX0phdmFTY3JpcHRLZXkiLCJfQ2xpZW50VmVyc2lvbiIsIl9JbnN0YWxsYXRpb25JZCIsIl9TZXNzaW9uVG9rZW4iLCJfTWFzdGVyS2V5IiwiX2NvbnRleHQiLCJfQ29udGVudFR5cGUiLCJoZWFkZXJzIiwiY2xpZW50U0RLIiwiQ2xpZW50U0RLIiwiZnJvbVN0cmluZyIsImZpbGVEYXRhIiwiYmFzZTY0IiwiZnJvbSIsImNsaWVudElwIiwiZ2V0Q2xpZW50SXAiLCJjb25maWciLCJDb25maWciLCJzdGF0ZSIsInN0YXR1cyIsImpzb24iLCJjb2RlIiwiUGFyc2UiLCJFcnJvciIsIklOVEVSTkFMX1NFUlZFUl9FUlJPUiIsImVycm9yIiwiYXBwIiwiaXAiLCJpc01haW50ZW5hbmNlIiwiaXBSYW5nZUNoZWNrIiwibWFpbnRlbmFuY2VLZXlJcHMiLCJhdXRoIiwiQXV0aCIsImxvZyIsImxvZ2dlckNvbnRyb2xsZXIiLCJkZWZhdWx0TG9nZ2VyIiwiaXNNYXN0ZXIiLCJtYXN0ZXJLZXlJcHMiLCJoYW5kbGVSYXRlTGltaXQiLCJpc1JlYWRPbmx5TWFzdGVyIiwicmVhZE9ubHlNYXN0ZXJLZXkiLCJpc1JlYWRPbmx5Iiwia2V5cyIsIm9uZUtleUNvbmZpZ3VyZWQiLCJzb21lIiwia2V5IiwidW5kZWZpbmVkIiwib25lS2V5TWF0Y2hlcyIsInVzZXJGcm9tSldUIiwidXNlciIsInJhdGVMaW1pdHMiLCJQcm9taXNlIiwiYWxsIiwibWFwIiwibGltaXQiLCJwYXRoRXhwIiwiUmVnRXhwIiwicGF0aCIsInRlc3QiLCJoYW5kbGVyIiwiZXJyIiwiQ09OTkVDVElPTl9GQUlMRUQiLCJtZXNzYWdlIiwiaGFuZGxlUGFyc2VTZXNzaW9uIiwicmVxdWVzdEF1dGgiLCJpbmRleE9mIiwiZ2V0QXV0aEZvckxlZ2FjeVNlc3Npb25Ub2tlbiIsImdldEF1dGhGb3JTZXNzaW9uVG9rZW4iLCJVTktOT1dOX0VSUk9SIiwiYXV0aG9yaXphdGlvbiIsImhlYWRlciIsImF1dGhQcmVmaXgiLCJtYXRjaCIsInRvTG93ZXJDYXNlIiwiZW5jb2RlZEF1dGgiLCJzdWJzdHJpbmciLCJjcmVkZW50aWFscyIsImRlY29kZUJhc2U2NCIsInNwbGl0IiwianNLZXlQcmVmaXgiLCJtYXRjaEtleSIsInN0ciIsImFsbG93Q3Jvc3NEb21haW4iLCJhbGxvd0hlYWRlcnMiLCJqb2luIiwiYmFzZU9yaWdpbnMiLCJhbGxvd09yaWdpbiIsInJlcXVlc3RPcmlnaW4iLCJvcmlnaW4iLCJhbGxvd09yaWdpbnMiLCJpbmNsdWRlcyIsIm1ldGhvZCIsInNlbmRTdGF0dXMiLCJhbGxvd01ldGhvZE92ZXJyaWRlIiwiX21ldGhvZCIsIm9yaWdpbmFsTWV0aG9kIiwiaGFuZGxlUGFyc2VFcnJvcnMiLCJlbmFibGVFeHByZXNzRXJyb3JIYW5kbGVyIiwiaHR0cFN0YXR1cyIsIk9CSkVDVF9OT1RfRk9VTkQiLCJwcm9jZXNzIiwiZW52IiwiVEVTVElORyIsInN0YWNrIiwiZW5mb3JjZU1hc3RlcktleUFjY2VzcyIsImVuZCIsInByb21pc2VFbmZvcmNlTWFzdGVyS2V5QWNjZXNzIiwicmVxdWVzdCIsInJlc29sdmUiLCJhZGRSYXRlTGltaXQiLCJyb3V0ZSIsImNsb3VkIiwiUmF0ZUxpbWl0T3B0aW9ucyIsInJlZGlzU3RvcmUiLCJjb25uZWN0aW9uUHJvbWlzZSIsInN0b3JlIiwiY29ubmVjdGVkIiwicmVkaXNVcmwiLCJjbGllbnQiLCJjcmVhdGVDbGllbnQiLCJjb25uZWN0IiwiUmVkaXNTdG9yZSIsInNlbmRDb21tYW5kIiwiYXJncyIsInRyYW5zZm9ybVBhdGgiLCJyZXF1ZXN0UGF0aCIsInB1c2giLCJwYXRoVG9SZWdleHAiLCJyYXRlTGltaXQiLCJ3aW5kb3dNcyIsInJlcXVlc3RUaW1lV2luZG93IiwibWF4IiwicmVxdWVzdENvdW50IiwiZXJyb3JSZXNwb25zZU1lc3NhZ2UiLCJkZWZhdWx0IiwicmVzcG9uc2UiLCJvcHRpb25zIiwic2tpcCIsImluY2x1ZGVJbnRlcm5hbFJlcXVlc3RzIiwiaW5jbHVkZU1hc3RlcktleSIsInJlcXVlc3RNZXRob2RzIiwiQXJyYXkiLCJpc0FycmF5IiwicmVnRXhwIiwia2V5R2VuZXJhdG9yIiwiem9uZSIsIlNlcnZlciIsIlJhdGVMaW1pdFpvbmUiLCJnbG9iYWwiLCJ0b2tlbiIsInNlc3Npb24iLCJpZCIsInB1dCIsInByb21pc2VFbnN1cmVJZGVtcG90ZW5jeSIsImRhdGFiYXNlIiwiYWRhcHRlciIsIk1vbmdvU3RvcmFnZUFkYXB0ZXIiLCJQb3N0Z3Jlc1N0b3JhZ2VBZGFwdGVyIiwicmVxdWVzdElkIiwicGF0aHMiLCJ0dGwiLCJpZGVtcG90ZW5jeU9wdGlvbnMiLCJyZXFQYXRoIiwicmVwbGFjZSIsInJlZ2V4IiwiY2hhckF0IiwiZXhwaXJ5RGF0ZSIsIkRhdGUiLCJzZXRTZWNvbmRzIiwiZ2V0U2Vjb25kcyIsInJlc3QiLCJjcmVhdGUiLCJtYXN0ZXIiLCJyZXFJZCIsImV4cGlyZSIsIl9lbmNvZGUiLCJjYXRjaCIsIkRVUExJQ0FURV9WQUxVRSIsIkRVUExJQ0FURV9SRVFVRVNUIiwiSU5WQUxJRF9KU09OIl0sInNvdXJjZXMiOlsiLi4vc3JjL21pZGRsZXdhcmVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBBcHBDYWNoZSBmcm9tICcuL2NhY2hlJztcbmltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCBhdXRoIGZyb20gJy4vQXV0aCc7XG5pbXBvcnQgQ29uZmlnIGZyb20gJy4vQ29uZmlnJztcbmltcG9ydCBDbGllbnRTREsgZnJvbSAnLi9DbGllbnRTREsnO1xuaW1wb3J0IGRlZmF1bHRMb2dnZXIgZnJvbSAnLi9sb2dnZXInO1xuaW1wb3J0IHJlc3QgZnJvbSAnLi9yZXN0JztcbmltcG9ydCBNb25nb1N0b3JhZ2VBZGFwdGVyIGZyb20gJy4vQWRhcHRlcnMvU3RvcmFnZS9Nb25nby9Nb25nb1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCBQb3N0Z3Jlc1N0b3JhZ2VBZGFwdGVyIGZyb20gJy4vQWRhcHRlcnMvU3RvcmFnZS9Qb3N0Z3Jlcy9Qb3N0Z3Jlc1N0b3JhZ2VBZGFwdGVyJztcbmltcG9ydCByYXRlTGltaXQgZnJvbSAnZXhwcmVzcy1yYXRlLWxpbWl0JztcbmltcG9ydCB7IFJhdGVMaW1pdE9wdGlvbnMgfSBmcm9tICcuL09wdGlvbnMvRGVmaW5pdGlvbnMnO1xuaW1wb3J0IHsgcGF0aFRvUmVnZXhwIH0gZnJvbSAncGF0aC10by1yZWdleHAnO1xuaW1wb3J0IGlwUmFuZ2VDaGVjayBmcm9tICdpcC1yYW5nZS1jaGVjayc7XG5pbXBvcnQgUmVkaXNTdG9yZSBmcm9tICdyYXRlLWxpbWl0LXJlZGlzJztcbmltcG9ydCB7IGNyZWF0ZUNsaWVudCB9IGZyb20gJ3JlZGlzJztcblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfQUxMT1dFRF9IRUFERVJTID1cbiAgJ1gtUGFyc2UtTWFzdGVyLUtleSwgWC1QYXJzZS1SRVNULUFQSS1LZXksIFgtUGFyc2UtSmF2YXNjcmlwdC1LZXksIFgtUGFyc2UtQXBwbGljYXRpb24tSWQsIFgtUGFyc2UtQ2xpZW50LVZlcnNpb24sIFgtUGFyc2UtU2Vzc2lvbi1Ub2tlbiwgWC1SZXF1ZXN0ZWQtV2l0aCwgWC1QYXJzZS1SZXZvY2FibGUtU2Vzc2lvbiwgWC1QYXJzZS1SZXF1ZXN0LUlkLCBDb250ZW50LVR5cGUsIFByYWdtYSwgQ2FjaGUtQ29udHJvbCc7XG5cbmNvbnN0IGdldE1vdW50Rm9yUmVxdWVzdCA9IGZ1bmN0aW9uIChyZXEpIHtcbiAgY29uc3QgbW91bnRQYXRoTGVuZ3RoID0gcmVxLm9yaWdpbmFsVXJsLmxlbmd0aCAtIHJlcS51cmwubGVuZ3RoO1xuICBjb25zdCBtb3VudFBhdGggPSByZXEub3JpZ2luYWxVcmwuc2xpY2UoMCwgbW91bnRQYXRoTGVuZ3RoKTtcbiAgcmV0dXJuIHJlcS5wcm90b2NvbCArICc6Ly8nICsgcmVxLmdldCgnaG9zdCcpICsgbW91bnRQYXRoO1xufTtcblxuLy8gQ2hlY2tzIHRoYXQgdGhlIHJlcXVlc3QgaXMgYXV0aG9yaXplZCBmb3IgdGhpcyBhcHAgYW5kIGNoZWNrcyB1c2VyXG4vLyBhdXRoIHRvby5cbi8vIFRoZSBib2R5cGFyc2VyIHNob3VsZCBydW4gYmVmb3JlIHRoaXMgbWlkZGxld2FyZS5cbi8vIEFkZHMgaW5mbyB0byB0aGUgcmVxdWVzdDpcbi8vIHJlcS5jb25maWcgLSB0aGUgQ29uZmlnIGZvciB0aGlzIGFwcFxuLy8gcmVxLmF1dGggLSB0aGUgQXV0aCBmb3IgdGhpcyByZXF1ZXN0XG5leHBvcnQgZnVuY3Rpb24gaGFuZGxlUGFyc2VIZWFkZXJzKHJlcSwgcmVzLCBuZXh0KSB7XG4gIHZhciBtb3VudCA9IGdldE1vdW50Rm9yUmVxdWVzdChyZXEpO1xuXG4gIGxldCBjb250ZXh0ID0ge307XG4gIGlmIChyZXEuZ2V0KCdYLVBhcnNlLUNsb3VkLUNvbnRleHQnKSAhPSBudWxsKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnRleHQgPSBKU09OLnBhcnNlKHJlcS5nZXQoJ1gtUGFyc2UtQ2xvdWQtQ29udGV4dCcpKTtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoY29udGV4dCkgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG4gICAgICAgIHRocm93ICdDb250ZXh0IGlzIG5vdCBhbiBvYmplY3QnO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBtYWxmb3JtZWRDb250ZXh0KHJlcSwgcmVzKTtcbiAgICB9XG4gIH1cbiAgdmFyIGluZm8gPSB7XG4gICAgYXBwSWQ6IHJlcS5nZXQoJ1gtUGFyc2UtQXBwbGljYXRpb24tSWQnKSxcbiAgICBzZXNzaW9uVG9rZW46IHJlcS5nZXQoJ1gtUGFyc2UtU2Vzc2lvbi1Ub2tlbicpLFxuICAgIG1hc3RlcktleTogcmVxLmdldCgnWC1QYXJzZS1NYXN0ZXItS2V5JyksXG4gICAgbWFpbnRlbmFuY2VLZXk6IHJlcS5nZXQoJ1gtUGFyc2UtTWFpbnRlbmFuY2UtS2V5JyksXG4gICAgaW5zdGFsbGF0aW9uSWQ6IHJlcS5nZXQoJ1gtUGFyc2UtSW5zdGFsbGF0aW9uLUlkJyksXG4gICAgY2xpZW50S2V5OiByZXEuZ2V0KCdYLVBhcnNlLUNsaWVudC1LZXknKSxcbiAgICBqYXZhc2NyaXB0S2V5OiByZXEuZ2V0KCdYLVBhcnNlLUphdmFzY3JpcHQtS2V5JyksXG4gICAgZG90TmV0S2V5OiByZXEuZ2V0KCdYLVBhcnNlLVdpbmRvd3MtS2V5JyksXG4gICAgcmVzdEFQSUtleTogcmVxLmdldCgnWC1QYXJzZS1SRVNULUFQSS1LZXknKSxcbiAgICBjbGllbnRWZXJzaW9uOiByZXEuZ2V0KCdYLVBhcnNlLUNsaWVudC1WZXJzaW9uJyksXG4gICAgY29udGV4dDogY29udGV4dCxcbiAgfTtcblxuICB2YXIgYmFzaWNBdXRoID0gaHR0cEF1dGgocmVxKTtcblxuICBpZiAoYmFzaWNBdXRoKSB7XG4gICAgdmFyIGJhc2ljQXV0aEFwcElkID0gYmFzaWNBdXRoLmFwcElkO1xuICAgIGlmIChBcHBDYWNoZS5nZXQoYmFzaWNBdXRoQXBwSWQpKSB7XG4gICAgICBpbmZvLmFwcElkID0gYmFzaWNBdXRoQXBwSWQ7XG4gICAgICBpbmZvLm1hc3RlcktleSA9IGJhc2ljQXV0aC5tYXN0ZXJLZXkgfHwgaW5mby5tYXN0ZXJLZXk7XG4gICAgICBpbmZvLmphdmFzY3JpcHRLZXkgPSBiYXNpY0F1dGguamF2YXNjcmlwdEtleSB8fCBpbmZvLmphdmFzY3JpcHRLZXk7XG4gICAgfVxuICB9XG5cbiAgaWYgKHJlcS5ib2R5KSB7XG4gICAgLy8gVW5pdHkgU0RLIHNlbmRzIGEgX25vQm9keSBrZXkgd2hpY2ggbmVlZHMgdG8gYmUgcmVtb3ZlZC5cbiAgICAvLyBVbmNsZWFyIGF0IHRoaXMgcG9pbnQgaWYgYWN0aW9uIG5lZWRzIHRvIGJlIHRha2VuLlxuICAgIGRlbGV0ZSByZXEuYm9keS5fbm9Cb2R5O1xuICB9XG5cbiAgdmFyIGZpbGVWaWFKU09OID0gZmFsc2U7XG5cbiAgaWYgKCFpbmZvLmFwcElkIHx8ICFBcHBDYWNoZS5nZXQoaW5mby5hcHBJZCkpIHtcbiAgICAvLyBTZWUgaWYgd2UgY2FuIGZpbmQgdGhlIGFwcCBpZCBvbiB0aGUgYm9keS5cbiAgICBpZiAocmVxLmJvZHkgaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgIC8vIFRoZSBvbmx5IGNoYW5jZSB0byBmaW5kIHRoZSBhcHAgaWQgaXMgaWYgdGhpcyBpcyBhIGZpbGVcbiAgICAgIC8vIHVwbG9hZCB0aGF0IGFjdHVhbGx5IGlzIGEgSlNPTiBib2R5LiBTbyB0cnkgdG8gcGFyc2UgaXQuXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGFyc2UtY29tbXVuaXR5L3BhcnNlLXNlcnZlci9pc3N1ZXMvNjU4OVxuICAgICAgLy8gSXQgaXMgYWxzbyBwb3NzaWJsZSB0aGF0IHRoZSBjbGllbnQgaXMgdHJ5aW5nIHRvIHVwbG9hZCBhIGZpbGUgYnV0IGZvcmdvdFxuICAgICAgLy8gdG8gcHJvdmlkZSB4LXBhcnNlLWFwcC1pZCBpbiBoZWFkZXIgYW5kIHBhcnNlIGEgYmluYXJ5IGZpbGUgd2lsbCBmYWlsXG4gICAgICB0cnkge1xuICAgICAgICByZXEuYm9keSA9IEpTT04ucGFyc2UocmVxLmJvZHkpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gaW52YWxpZFJlcXVlc3QocmVxLCByZXMpO1xuICAgICAgfVxuICAgICAgZmlsZVZpYUpTT04gPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChyZXEuYm9keSkge1xuICAgICAgZGVsZXRlIHJlcS5ib2R5Ll9SZXZvY2FibGVTZXNzaW9uO1xuICAgIH1cblxuICAgIGlmIChcbiAgICAgIHJlcS5ib2R5ICYmXG4gICAgICByZXEuYm9keS5fQXBwbGljYXRpb25JZCAmJlxuICAgICAgQXBwQ2FjaGUuZ2V0KHJlcS5ib2R5Ll9BcHBsaWNhdGlvbklkKSAmJlxuICAgICAgKCFpbmZvLm1hc3RlcktleSB8fCBBcHBDYWNoZS5nZXQocmVxLmJvZHkuX0FwcGxpY2F0aW9uSWQpLm1hc3RlcktleSA9PT0gaW5mby5tYXN0ZXJLZXkpXG4gICAgKSB7XG4gICAgICBpbmZvLmFwcElkID0gcmVxLmJvZHkuX0FwcGxpY2F0aW9uSWQ7XG4gICAgICBpbmZvLmphdmFzY3JpcHRLZXkgPSByZXEuYm9keS5fSmF2YVNjcmlwdEtleSB8fCAnJztcbiAgICAgIGRlbGV0ZSByZXEuYm9keS5fQXBwbGljYXRpb25JZDtcbiAgICAgIGRlbGV0ZSByZXEuYm9keS5fSmF2YVNjcmlwdEtleTtcbiAgICAgIC8vIFRPRE86IHRlc3QgdGhhdCB0aGUgUkVTVCBBUEkgZm9ybWF0cyBnZW5lcmF0ZWQgYnkgdGhlIG90aGVyXG4gICAgICAvLyBTREtzIGFyZSBoYW5kbGVkIG9rXG4gICAgICBpZiAocmVxLmJvZHkuX0NsaWVudFZlcnNpb24pIHtcbiAgICAgICAgaW5mby5jbGllbnRWZXJzaW9uID0gcmVxLmJvZHkuX0NsaWVudFZlcnNpb247XG4gICAgICAgIGRlbGV0ZSByZXEuYm9keS5fQ2xpZW50VmVyc2lvbjtcbiAgICAgIH1cbiAgICAgIGlmIChyZXEuYm9keS5fSW5zdGFsbGF0aW9uSWQpIHtcbiAgICAgICAgaW5mby5pbnN0YWxsYXRpb25JZCA9IHJlcS5ib2R5Ll9JbnN0YWxsYXRpb25JZDtcbiAgICAgICAgZGVsZXRlIHJlcS5ib2R5Ll9JbnN0YWxsYXRpb25JZDtcbiAgICAgIH1cbiAgICAgIGlmIChyZXEuYm9keS5fU2Vzc2lvblRva2VuKSB7XG4gICAgICAgIGluZm8uc2Vzc2lvblRva2VuID0gcmVxLmJvZHkuX1Nlc3Npb25Ub2tlbjtcbiAgICAgICAgZGVsZXRlIHJlcS5ib2R5Ll9TZXNzaW9uVG9rZW47XG4gICAgICB9XG4gICAgICBpZiAocmVxLmJvZHkuX01hc3RlcktleSkge1xuICAgICAgICBpbmZvLm1hc3RlcktleSA9IHJlcS5ib2R5Ll9NYXN0ZXJLZXk7XG4gICAgICAgIGRlbGV0ZSByZXEuYm9keS5fTWFzdGVyS2V5O1xuICAgICAgfVxuICAgICAgaWYgKHJlcS5ib2R5Ll9jb250ZXh0KSB7XG4gICAgICAgIGlmIChyZXEuYm9keS5fY29udGV4dCBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICAgIGluZm8uY29udGV4dCA9IHJlcS5ib2R5Ll9jb250ZXh0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbmZvLmNvbnRleHQgPSBKU09OLnBhcnNlKHJlcS5ib2R5Ll9jb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaW5mby5jb250ZXh0KSAhPT0gJ1tvYmplY3QgT2JqZWN0XScpIHtcbiAgICAgICAgICAgICAgdGhyb3cgJ0NvbnRleHQgaXMgbm90IGFuIG9iamVjdCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIG1hbGZvcm1lZENvbnRleHQocmVxLCByZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgcmVxLmJvZHkuX2NvbnRleHQ7XG4gICAgICB9XG4gICAgICBpZiAocmVxLmJvZHkuX0NvbnRlbnRUeXBlKSB7XG4gICAgICAgIHJlcS5oZWFkZXJzWydjb250ZW50LXR5cGUnXSA9IHJlcS5ib2R5Ll9Db250ZW50VHlwZTtcbiAgICAgICAgZGVsZXRlIHJlcS5ib2R5Ll9Db250ZW50VHlwZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGludmFsaWRSZXF1ZXN0KHJlcSwgcmVzKTtcbiAgICB9XG4gIH1cblxuICBpZiAoaW5mby5zZXNzaW9uVG9rZW4gJiYgdHlwZW9mIGluZm8uc2Vzc2lvblRva2VuICE9PSAnc3RyaW5nJykge1xuICAgIGluZm8uc2Vzc2lvblRva2VuID0gaW5mby5zZXNzaW9uVG9rZW4udG9TdHJpbmcoKTtcbiAgfVxuXG4gIGlmIChpbmZvLmNsaWVudFZlcnNpb24pIHtcbiAgICBpbmZvLmNsaWVudFNESyA9IENsaWVudFNESy5mcm9tU3RyaW5nKGluZm8uY2xpZW50VmVyc2lvbik7XG4gIH1cblxuICBpZiAoZmlsZVZpYUpTT04pIHtcbiAgICByZXEuZmlsZURhdGEgPSByZXEuYm9keS5maWxlRGF0YTtcbiAgICAvLyBXZSBuZWVkIHRvIHJlcG9wdWxhdGUgcmVxLmJvZHkgd2l0aCBhIGJ1ZmZlclxuICAgIHZhciBiYXNlNjQgPSByZXEuYm9keS5iYXNlNjQ7XG4gICAgcmVxLmJvZHkgPSBCdWZmZXIuZnJvbShiYXNlNjQsICdiYXNlNjQnKTtcbiAgfVxuXG4gIGNvbnN0IGNsaWVudElwID0gZ2V0Q2xpZW50SXAocmVxKTtcbiAgY29uc3QgY29uZmlnID0gQ29uZmlnLmdldChpbmZvLmFwcElkLCBtb3VudCk7XG4gIGlmIChjb25maWcuc3RhdGUgJiYgY29uZmlnLnN0YXRlICE9PSAnb2snKSB7XG4gICAgcmVzLnN0YXR1cyg1MDApO1xuICAgIHJlcy5qc29uKHtcbiAgICAgIGNvZGU6IFBhcnNlLkVycm9yLklOVEVSTkFMX1NFUlZFUl9FUlJPUixcbiAgICAgIGVycm9yOiBgSW52YWxpZCBzZXJ2ZXIgc3RhdGU6ICR7Y29uZmlnLnN0YXRlfWAsXG4gICAgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaW5mby5hcHAgPSBBcHBDYWNoZS5nZXQoaW5mby5hcHBJZCk7XG4gIHJlcS5jb25maWcgPSBjb25maWc7XG4gIHJlcS5jb25maWcuaGVhZGVycyA9IHJlcS5oZWFkZXJzIHx8IHt9O1xuICByZXEuY29uZmlnLmlwID0gY2xpZW50SXA7XG4gIHJlcS5pbmZvID0gaW5mbztcblxuICBjb25zdCBpc01haW50ZW5hbmNlID1cbiAgICByZXEuY29uZmlnLm1haW50ZW5hbmNlS2V5ICYmIGluZm8ubWFpbnRlbmFuY2VLZXkgPT09IHJlcS5jb25maWcubWFpbnRlbmFuY2VLZXk7XG4gIGlmIChpc01haW50ZW5hbmNlKSB7XG4gICAgaWYgKGlwUmFuZ2VDaGVjayhjbGllbnRJcCwgcmVxLmNvbmZpZy5tYWludGVuYW5jZUtleUlwcyB8fCBbXSkpIHtcbiAgICAgIHJlcS5hdXRoID0gbmV3IGF1dGguQXV0aCh7XG4gICAgICAgIGNvbmZpZzogcmVxLmNvbmZpZyxcbiAgICAgICAgaW5zdGFsbGF0aW9uSWQ6IGluZm8uaW5zdGFsbGF0aW9uSWQsXG4gICAgICAgIGlzTWFpbnRlbmFuY2U6IHRydWUsXG4gICAgICB9KTtcbiAgICAgIG5leHQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgbG9nID0gcmVxLmNvbmZpZz8ubG9nZ2VyQ29udHJvbGxlciB8fCBkZWZhdWx0TG9nZ2VyO1xuICAgIGxvZy5lcnJvcihcbiAgICAgIGBSZXF1ZXN0IHVzaW5nIG1haW50ZW5hbmNlIGtleSByZWplY3RlZCBhcyB0aGUgcmVxdWVzdCBJUCBhZGRyZXNzICcke2NsaWVudElwfScgaXMgbm90IHNldCBpbiBQYXJzZSBTZXJ2ZXIgb3B0aW9uICdtYWludGVuYW5jZUtleUlwcycuYFxuICAgICk7XG4gIH1cblxuICBsZXQgaXNNYXN0ZXIgPSBpbmZvLm1hc3RlcktleSA9PT0gcmVxLmNvbmZpZy5tYXN0ZXJLZXk7XG4gIGlmIChpc01hc3RlciAmJiAhaXBSYW5nZUNoZWNrKGNsaWVudElwLCByZXEuY29uZmlnLm1hc3RlcktleUlwcyB8fCBbXSkpIHtcbiAgICBjb25zdCBsb2cgPSByZXEuY29uZmlnPy5sb2dnZXJDb250cm9sbGVyIHx8IGRlZmF1bHRMb2dnZXI7XG4gICAgbG9nLmVycm9yKFxuICAgICAgYFJlcXVlc3QgdXNpbmcgbWFzdGVyIGtleSByZWplY3RlZCBhcyB0aGUgcmVxdWVzdCBJUCBhZGRyZXNzICcke2NsaWVudElwfScgaXMgbm90IHNldCBpbiBQYXJzZSBTZXJ2ZXIgb3B0aW9uICdtYXN0ZXJLZXlJcHMnLmBcbiAgICApO1xuICAgIGlzTWFzdGVyID0gZmFsc2U7XG4gIH1cblxuICBpZiAoaXNNYXN0ZXIpIHtcbiAgICByZXEuYXV0aCA9IG5ldyBhdXRoLkF1dGgoe1xuICAgICAgY29uZmlnOiByZXEuY29uZmlnLFxuICAgICAgaW5zdGFsbGF0aW9uSWQ6IGluZm8uaW5zdGFsbGF0aW9uSWQsXG4gICAgICBpc01hc3RlcjogdHJ1ZSxcbiAgICB9KTtcbiAgICByZXR1cm4gaGFuZGxlUmF0ZUxpbWl0KHJlcSwgcmVzLCBuZXh0KTtcbiAgfVxuXG4gIHZhciBpc1JlYWRPbmx5TWFzdGVyID0gaW5mby5tYXN0ZXJLZXkgPT09IHJlcS5jb25maWcucmVhZE9ubHlNYXN0ZXJLZXk7XG4gIGlmIChcbiAgICB0eXBlb2YgcmVxLmNvbmZpZy5yZWFkT25seU1hc3RlcktleSAhPSAndW5kZWZpbmVkJyAmJlxuICAgIHJlcS5jb25maWcucmVhZE9ubHlNYXN0ZXJLZXkgJiZcbiAgICBpc1JlYWRPbmx5TWFzdGVyXG4gICkge1xuICAgIHJlcS5hdXRoID0gbmV3IGF1dGguQXV0aCh7XG4gICAgICBjb25maWc6IHJlcS5jb25maWcsXG4gICAgICBpbnN0YWxsYXRpb25JZDogaW5mby5pbnN0YWxsYXRpb25JZCxcbiAgICAgIGlzTWFzdGVyOiB0cnVlLFxuICAgICAgaXNSZWFkT25seTogdHJ1ZSxcbiAgICB9KTtcbiAgICByZXR1cm4gaGFuZGxlUmF0ZUxpbWl0KHJlcSwgcmVzLCBuZXh0KTtcbiAgfVxuXG4gIC8vIENsaWVudCBrZXlzIGFyZSBub3QgcmVxdWlyZWQgaW4gcGFyc2Utc2VydmVyLCBidXQgaWYgYW55IGhhdmUgYmVlbiBjb25maWd1cmVkIGluIHRoZSBzZXJ2ZXIsIHZhbGlkYXRlIHRoZW1cbiAgLy8gIHRvIHByZXNlcnZlIG9yaWdpbmFsIGJlaGF2aW9yLlxuICBjb25zdCBrZXlzID0gWydjbGllbnRLZXknLCAnamF2YXNjcmlwdEtleScsICdkb3ROZXRLZXknLCAncmVzdEFQSUtleSddO1xuICBjb25zdCBvbmVLZXlDb25maWd1cmVkID0ga2V5cy5zb21lKGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gcmVxLmNvbmZpZ1trZXldICE9PSB1bmRlZmluZWQ7XG4gIH0pO1xuICBjb25zdCBvbmVLZXlNYXRjaGVzID0ga2V5cy5zb21lKGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gcmVxLmNvbmZpZ1trZXldICE9PSB1bmRlZmluZWQgJiYgaW5mb1trZXldID09PSByZXEuY29uZmlnW2tleV07XG4gIH0pO1xuXG4gIGlmIChvbmVLZXlDb25maWd1cmVkICYmICFvbmVLZXlNYXRjaGVzKSB7XG4gICAgcmV0dXJuIGludmFsaWRSZXF1ZXN0KHJlcSwgcmVzKTtcbiAgfVxuXG4gIGlmIChyZXEudXJsID09ICcvbG9naW4nKSB7XG4gICAgZGVsZXRlIGluZm8uc2Vzc2lvblRva2VuO1xuICB9XG5cbiAgaWYgKHJlcS51c2VyRnJvbUpXVCkge1xuICAgIHJlcS5hdXRoID0gbmV3IGF1dGguQXV0aCh7XG4gICAgICBjb25maWc6IHJlcS5jb25maWcsXG4gICAgICBpbnN0YWxsYXRpb25JZDogaW5mby5pbnN0YWxsYXRpb25JZCxcbiAgICAgIGlzTWFzdGVyOiBmYWxzZSxcbiAgICAgIHVzZXI6IHJlcS51c2VyRnJvbUpXVCxcbiAgICB9KTtcbiAgICByZXR1cm4gaGFuZGxlUmF0ZUxpbWl0KHJlcSwgcmVzLCBuZXh0KTtcbiAgfVxuXG4gIGlmICghaW5mby5zZXNzaW9uVG9rZW4pIHtcbiAgICByZXEuYXV0aCA9IG5ldyBhdXRoLkF1dGgoe1xuICAgICAgY29uZmlnOiByZXEuY29uZmlnLFxuICAgICAgaW5zdGFsbGF0aW9uSWQ6IGluZm8uaW5zdGFsbGF0aW9uSWQsXG4gICAgICBpc01hc3RlcjogZmFsc2UsXG4gICAgfSk7XG4gIH1cbiAgaGFuZGxlUmF0ZUxpbWl0KHJlcSwgcmVzLCBuZXh0KTtcbn1cblxuY29uc3QgaGFuZGxlUmF0ZUxpbWl0ID0gYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gIGNvbnN0IHJhdGVMaW1pdHMgPSByZXEuY29uZmlnLnJhdGVMaW1pdHMgfHwgW107XG4gIHRyeSB7XG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICByYXRlTGltaXRzLm1hcChhc3luYyBsaW1pdCA9PiB7XG4gICAgICAgIGNvbnN0IHBhdGhFeHAgPSBuZXcgUmVnRXhwKGxpbWl0LnBhdGgpO1xuICAgICAgICBpZiAocGF0aEV4cC50ZXN0KHJlcS51cmwpKSB7XG4gICAgICAgICAgYXdhaXQgbGltaXQuaGFuZGxlcihyZXEsIHJlcywgZXJyID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgaWYgKGVyci5jb2RlID09PSBQYXJzZS5FcnJvci5DT05ORUNUSU9OX0ZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXEuY29uZmlnLmxvZ2dlckNvbnRyb2xsZXIuZXJyb3IoXG4gICAgICAgICAgICAgICAgJ0FuIHVua25vd24gZXJyb3Igb2NjdXJlZCB3aGVuIGF0dGVtcHRpbmcgdG8gYXBwbHkgdGhlIHJhdGUgbGltaXRlcjogJyxcbiAgICAgICAgICAgICAgICBlcnJcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICApO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIHJlcy5zdGF0dXMoNDI5KTtcbiAgICByZXMuanNvbih7IGNvZGU6IFBhcnNlLkVycm9yLkNPTk5FQ1RJT05fRkFJTEVELCBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgbmV4dCgpO1xufTtcblxuZXhwb3J0IGNvbnN0IGhhbmRsZVBhcnNlU2Vzc2lvbiA9IGFzeW5jIChyZXEsIHJlcywgbmV4dCkgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGluZm8gPSByZXEuaW5mbztcbiAgICBpZiAocmVxLmF1dGgpIHtcbiAgICAgIG5leHQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbGV0IHJlcXVlc3RBdXRoID0gbnVsbDtcbiAgICBpZiAoXG4gICAgICBpbmZvLnNlc3Npb25Ub2tlbiAmJlxuICAgICAgcmVxLnVybCA9PT0gJy91cGdyYWRlVG9SZXZvY2FibGVTZXNzaW9uJyAmJlxuICAgICAgaW5mby5zZXNzaW9uVG9rZW4uaW5kZXhPZigncjonKSAhPSAwXG4gICAgKSB7XG4gICAgICByZXF1ZXN0QXV0aCA9IGF3YWl0IGF1dGguZ2V0QXV0aEZvckxlZ2FjeVNlc3Npb25Ub2tlbih7XG4gICAgICAgIGNvbmZpZzogcmVxLmNvbmZpZyxcbiAgICAgICAgaW5zdGFsbGF0aW9uSWQ6IGluZm8uaW5zdGFsbGF0aW9uSWQsXG4gICAgICAgIHNlc3Npb25Ub2tlbjogaW5mby5zZXNzaW9uVG9rZW4sXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVxdWVzdEF1dGggPSBhd2FpdCBhdXRoLmdldEF1dGhGb3JTZXNzaW9uVG9rZW4oe1xuICAgICAgICBjb25maWc6IHJlcS5jb25maWcsXG4gICAgICAgIGluc3RhbGxhdGlvbklkOiBpbmZvLmluc3RhbGxhdGlvbklkLFxuICAgICAgICBzZXNzaW9uVG9rZW46IGluZm8uc2Vzc2lvblRva2VuLFxuICAgICAgfSk7XG4gICAgfVxuICAgIHJlcS5hdXRoID0gcmVxdWVzdEF1dGg7XG4gICAgbmV4dCgpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFBhcnNlLkVycm9yKSB7XG4gICAgICBuZXh0KGVycm9yKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gVE9ETzogRGV0ZXJtaW5lIHRoZSBjb3JyZWN0IGVycm9yIHNjZW5hcmlvLlxuICAgIHJlcS5jb25maWcubG9nZ2VyQ29udHJvbGxlci5lcnJvcignZXJyb3IgZ2V0dGluZyBhdXRoIGZvciBzZXNzaW9uVG9rZW4nLCBlcnJvcik7XG4gICAgdGhyb3cgbmV3IFBhcnNlLkVycm9yKFBhcnNlLkVycm9yLlVOS05PV05fRVJST1IsIGVycm9yKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2V0Q2xpZW50SXAocmVxKSB7XG4gIHJldHVybiByZXEuaXA7XG59XG5cbmZ1bmN0aW9uIGh0dHBBdXRoKHJlcSkge1xuICBpZiAoIShyZXEucmVxIHx8IHJlcSkuaGVhZGVycy5hdXRob3JpemF0aW9uKSByZXR1cm47XG5cbiAgdmFyIGhlYWRlciA9IChyZXEucmVxIHx8IHJlcSkuaGVhZGVycy5hdXRob3JpemF0aW9uO1xuICB2YXIgYXBwSWQsIG1hc3RlcktleSwgamF2YXNjcmlwdEtleTtcblxuICAvLyBwYXJzZSBoZWFkZXJcbiAgdmFyIGF1dGhQcmVmaXggPSAnYmFzaWMgJztcblxuICB2YXIgbWF0Y2ggPSBoZWFkZXIudG9Mb3dlckNhc2UoKS5pbmRleE9mKGF1dGhQcmVmaXgpO1xuXG4gIGlmIChtYXRjaCA9PSAwKSB7XG4gICAgdmFyIGVuY29kZWRBdXRoID0gaGVhZGVyLnN1YnN0cmluZyhhdXRoUHJlZml4Lmxlbmd0aCwgaGVhZGVyLmxlbmd0aCk7XG4gICAgdmFyIGNyZWRlbnRpYWxzID0gZGVjb2RlQmFzZTY0KGVuY29kZWRBdXRoKS5zcGxpdCgnOicpO1xuXG4gICAgaWYgKGNyZWRlbnRpYWxzLmxlbmd0aCA9PSAyKSB7XG4gICAgICBhcHBJZCA9IGNyZWRlbnRpYWxzWzBdO1xuICAgICAgdmFyIGtleSA9IGNyZWRlbnRpYWxzWzFdO1xuXG4gICAgICB2YXIganNLZXlQcmVmaXggPSAnamF2YXNjcmlwdC1rZXk9JztcblxuICAgICAgdmFyIG1hdGNoS2V5ID0ga2V5LmluZGV4T2YoanNLZXlQcmVmaXgpO1xuICAgICAgaWYgKG1hdGNoS2V5ID09IDApIHtcbiAgICAgICAgamF2YXNjcmlwdEtleSA9IGtleS5zdWJzdHJpbmcoanNLZXlQcmVmaXgubGVuZ3RoLCBrZXkubGVuZ3RoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1hc3RlcktleSA9IGtleTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4geyBhcHBJZDogYXBwSWQsIG1hc3RlcktleTogbWFzdGVyS2V5LCBqYXZhc2NyaXB0S2V5OiBqYXZhc2NyaXB0S2V5IH07XG59XG5cbmZ1bmN0aW9uIGRlY29kZUJhc2U2NChzdHIpIHtcbiAgcmV0dXJuIEJ1ZmZlci5mcm9tKHN0ciwgJ2Jhc2U2NCcpLnRvU3RyaW5nKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhbGxvd0Nyb3NzRG9tYWluKGFwcElkKSB7XG4gIHJldHVybiAocmVxLCByZXMsIG5leHQpID0+IHtcbiAgICBjb25zdCBjb25maWcgPSBDb25maWcuZ2V0KGFwcElkLCBnZXRNb3VudEZvclJlcXVlc3QocmVxKSk7XG4gICAgbGV0IGFsbG93SGVhZGVycyA9IERFRkFVTFRfQUxMT1dFRF9IRUFERVJTO1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLmFsbG93SGVhZGVycykge1xuICAgICAgYWxsb3dIZWFkZXJzICs9IGAsICR7Y29uZmlnLmFsbG93SGVhZGVycy5qb2luKCcsICcpfWA7XG4gICAgfVxuXG4gICAgY29uc3QgYmFzZU9yaWdpbnMgPVxuICAgICAgdHlwZW9mIGNvbmZpZz8uYWxsb3dPcmlnaW4gPT09ICdzdHJpbmcnID8gW2NvbmZpZy5hbGxvd09yaWdpbl0gOiBjb25maWc/LmFsbG93T3JpZ2luID8/IFsnKiddO1xuICAgIGNvbnN0IHJlcXVlc3RPcmlnaW4gPSByZXEuaGVhZGVycy5vcmlnaW47XG4gICAgY29uc3QgYWxsb3dPcmlnaW5zID1cbiAgICAgIHJlcXVlc3RPcmlnaW4gJiYgYmFzZU9yaWdpbnMuaW5jbHVkZXMocmVxdWVzdE9yaWdpbikgPyByZXF1ZXN0T3JpZ2luIDogYmFzZU9yaWdpbnNbMF07XG4gICAgcmVzLmhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgYWxsb3dPcmlnaW5zKTtcbiAgICByZXMuaGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJywgJ0dFVCxQVVQsUE9TVCxERUxFVEUsT1BUSU9OUycpO1xuICAgIHJlcy5oZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnLCBhbGxvd0hlYWRlcnMpO1xuICAgIHJlcy5oZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUV4cG9zZS1IZWFkZXJzJywgJ1gtUGFyc2UtSm9iLVN0YXR1cy1JZCwgWC1QYXJzZS1QdXNoLVN0YXR1cy1JZCcpO1xuICAgIC8vIGludGVyY2VwdCBPUFRJT05TIG1ldGhvZFxuICAgIGlmICgnT1BUSU9OUycgPT0gcmVxLm1ldGhvZCkge1xuICAgICAgcmVzLnNlbmRTdGF0dXMoMjAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFsbG93TWV0aG9kT3ZlcnJpZGUocmVxLCByZXMsIG5leHQpIHtcbiAgaWYgKHJlcS5tZXRob2QgPT09ICdQT1NUJyAmJiByZXEuYm9keS5fbWV0aG9kKSB7XG4gICAgcmVxLm9yaWdpbmFsTWV0aG9kID0gcmVxLm1ldGhvZDtcbiAgICByZXEubWV0aG9kID0gcmVxLmJvZHkuX21ldGhvZDtcbiAgICBkZWxldGUgcmVxLmJvZHkuX21ldGhvZDtcbiAgfVxuICBuZXh0KCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYW5kbGVQYXJzZUVycm9ycyhlcnIsIHJlcSwgcmVzLCBuZXh0KSB7XG4gIGNvbnN0IGxvZyA9IChyZXEuY29uZmlnICYmIHJlcS5jb25maWcubG9nZ2VyQ29udHJvbGxlcikgfHwgZGVmYXVsdExvZ2dlcjtcbiAgaWYgKGVyciBpbnN0YW5jZW9mIFBhcnNlLkVycm9yKSB7XG4gICAgaWYgKHJlcS5jb25maWcgJiYgcmVxLmNvbmZpZy5lbmFibGVFeHByZXNzRXJyb3JIYW5kbGVyKSB7XG4gICAgICByZXR1cm4gbmV4dChlcnIpO1xuICAgIH1cbiAgICBsZXQgaHR0cFN0YXR1cztcbiAgICAvLyBUT0RPOiBmaWxsIG91dCB0aGlzIG1hcHBpbmdcbiAgICBzd2l0Y2ggKGVyci5jb2RlKSB7XG4gICAgICBjYXNlIFBhcnNlLkVycm9yLklOVEVSTkFMX1NFUlZFUl9FUlJPUjpcbiAgICAgICAgaHR0cFN0YXR1cyA9IDUwMDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFBhcnNlLkVycm9yLk9CSkVDVF9OT1RfRk9VTkQ6XG4gICAgICAgIGh0dHBTdGF0dXMgPSA0MDQ7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaHR0cFN0YXR1cyA9IDQwMDtcbiAgICB9XG4gICAgcmVzLnN0YXR1cyhodHRwU3RhdHVzKTtcbiAgICByZXMuanNvbih7IGNvZGU6IGVyci5jb2RlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgbG9nLmVycm9yKCdQYXJzZSBlcnJvcjogJywgZXJyKTtcbiAgfSBlbHNlIGlmIChlcnIuc3RhdHVzICYmIGVyci5tZXNzYWdlKSB7XG4gICAgcmVzLnN0YXR1cyhlcnIuc3RhdHVzKTtcbiAgICByZXMuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICBpZiAoIShwcm9jZXNzICYmIHByb2Nlc3MuZW52LlRFU1RJTkcpKSB7XG4gICAgICBuZXh0KGVycik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGxvZy5lcnJvcignVW5jYXVnaHQgaW50ZXJuYWwgc2VydmVyIGVycm9yLicsIGVyciwgZXJyLnN0YWNrKTtcbiAgICByZXMuc3RhdHVzKDUwMCk7XG4gICAgcmVzLmpzb24oe1xuICAgICAgY29kZTogUGFyc2UuRXJyb3IuSU5URVJOQUxfU0VSVkVSX0VSUk9SLFxuICAgICAgbWVzc2FnZTogJ0ludGVybmFsIHNlcnZlciBlcnJvci4nLFxuICAgIH0pO1xuICAgIGlmICghKHByb2Nlc3MgJiYgcHJvY2Vzcy5lbnYuVEVTVElORykpIHtcbiAgICAgIG5leHQoZXJyKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuZm9yY2VNYXN0ZXJLZXlBY2Nlc3MocmVxLCByZXMsIG5leHQpIHtcbiAgaWYgKCFyZXEuYXV0aC5pc01hc3Rlcikge1xuICAgIHJlcy5zdGF0dXMoNDAzKTtcbiAgICByZXMuZW5kKCd7XCJlcnJvclwiOlwidW5hdXRob3JpemVkOiBtYXN0ZXIga2V5IGlzIHJlcXVpcmVkXCJ9Jyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIG5leHQoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb21pc2VFbmZvcmNlTWFzdGVyS2V5QWNjZXNzKHJlcXVlc3QpIHtcbiAgaWYgKCFyZXF1ZXN0LmF1dGguaXNNYXN0ZXIpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcigpO1xuICAgIGVycm9yLnN0YXR1cyA9IDQwMztcbiAgICBlcnJvci5tZXNzYWdlID0gJ3VuYXV0aG9yaXplZDogbWFzdGVyIGtleSBpcyByZXF1aXJlZCc7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xufVxuXG5leHBvcnQgY29uc3QgYWRkUmF0ZUxpbWl0ID0gKHJvdXRlLCBjb25maWcsIGNsb3VkKSA9PiB7XG4gIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgIGNvbmZpZyA9IENvbmZpZy5nZXQoY29uZmlnKTtcbiAgfVxuICBmb3IgKGNvbnN0IGtleSBpbiByb3V0ZSkge1xuICAgIGlmICghUmF0ZUxpbWl0T3B0aW9uc1trZXldKSB7XG4gICAgICB0aHJvdyBgSW52YWxpZCByYXRlIGxpbWl0IG9wdGlvbiBcIiR7a2V5fVwiYDtcbiAgICB9XG4gIH1cbiAgaWYgKCFjb25maWcucmF0ZUxpbWl0cykge1xuICAgIGNvbmZpZy5yYXRlTGltaXRzID0gW107XG4gIH1cbiAgY29uc3QgcmVkaXNTdG9yZSA9IHtcbiAgICBjb25uZWN0aW9uUHJvbWlzZTogUHJvbWlzZS5yZXNvbHZlKCksXG4gICAgc3RvcmU6IG51bGwsXG4gICAgY29ubmVjdGVkOiBmYWxzZSxcbiAgfTtcbiAgaWYgKHJvdXRlLnJlZGlzVXJsKSB7XG4gICAgY29uc3QgY2xpZW50ID0gY3JlYXRlQ2xpZW50KHtcbiAgICAgIHVybDogcm91dGUucmVkaXNVcmwsXG4gICAgfSk7XG4gICAgcmVkaXNTdG9yZS5jb25uZWN0aW9uUHJvbWlzZSA9IGFzeW5jICgpID0+IHtcbiAgICAgIGlmIChyZWRpc1N0b3JlLmNvbm5lY3RlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBjbGllbnQuY29ubmVjdCgpO1xuICAgICAgICByZWRpc1N0b3JlLmNvbm5lY3RlZCA9IHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnN0IGxvZyA9IGNvbmZpZz8ubG9nZ2VyQ29udHJvbGxlciB8fCBkZWZhdWx0TG9nZ2VyO1xuICAgICAgICBsb2cuZXJyb3IoYENvdWxkIG5vdCBjb25uZWN0IHRvIHJlZGlzVVJMIGluIHJhdGUgbGltaXQ6ICR7ZX1gKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHJlZGlzU3RvcmUuY29ubmVjdGlvblByb21pc2UoKTtcbiAgICByZWRpc1N0b3JlLnN0b3JlID0gbmV3IFJlZGlzU3RvcmUoe1xuICAgICAgc2VuZENvbW1hbmQ6IGFzeW5jICguLi5hcmdzKSA9PiB7XG4gICAgICAgIGF3YWl0IHJlZGlzU3RvcmUuY29ubmVjdGlvblByb21pc2UoKTtcbiAgICAgICAgcmV0dXJuIGNsaWVudC5zZW5kQ29tbWFuZChhcmdzKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cbiAgbGV0IHRyYW5zZm9ybVBhdGggPSByb3V0ZS5yZXF1ZXN0UGF0aC5zcGxpdCgnLyonKS5qb2luKCcvKC4qKScpO1xuICBpZiAodHJhbnNmb3JtUGF0aCA9PT0gJyonKSB7XG4gICAgdHJhbnNmb3JtUGF0aCA9ICcoLiopJztcbiAgfVxuICBjb25maWcucmF0ZUxpbWl0cy5wdXNoKHtcbiAgICBwYXRoOiBwYXRoVG9SZWdleHAodHJhbnNmb3JtUGF0aCksXG4gICAgaGFuZGxlcjogcmF0ZUxpbWl0KHtcbiAgICAgIHdpbmRvd01zOiByb3V0ZS5yZXF1ZXN0VGltZVdpbmRvdyxcbiAgICAgIG1heDogcm91dGUucmVxdWVzdENvdW50LFxuICAgICAgbWVzc2FnZTogcm91dGUuZXJyb3JSZXNwb25zZU1lc3NhZ2UgfHwgUmF0ZUxpbWl0T3B0aW9ucy5lcnJvclJlc3BvbnNlTWVzc2FnZS5kZWZhdWx0LFxuICAgICAgaGFuZGxlcjogKHJlcXVlc3QsIHJlc3BvbnNlLCBuZXh0LCBvcHRpb25zKSA9PiB7XG4gICAgICAgIHRocm93IHtcbiAgICAgICAgICBjb2RlOiBQYXJzZS5FcnJvci5DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgICBtZXNzYWdlOiBvcHRpb25zLm1lc3NhZ2UsXG4gICAgICAgIH07XG4gICAgICB9LFxuICAgICAgc2tpcDogcmVxdWVzdCA9PiB7XG4gICAgICAgIGlmIChyZXF1ZXN0LmlwID09PSAnMTI3LjAuMC4xJyAmJiAhcm91dGUuaW5jbHVkZUludGVybmFsUmVxdWVzdHMpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocm91dGUuaW5jbHVkZU1hc3RlcktleSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocm91dGUucmVxdWVzdE1ldGhvZHMpIHtcbiAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyb3V0ZS5yZXF1ZXN0TWV0aG9kcykpIHtcbiAgICAgICAgICAgIGlmICghcm91dGUucmVxdWVzdE1ldGhvZHMuaW5jbHVkZXMocmVxdWVzdC5tZXRob2QpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByZWdFeHAgPSBuZXcgUmVnRXhwKHJvdXRlLnJlcXVlc3RNZXRob2RzKTtcbiAgICAgICAgICAgIGlmICghcmVnRXhwLnRlc3QocmVxdWVzdC5tZXRob2QpKSB7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVxdWVzdC5hdXRoPy5pc01hc3RlcjtcbiAgICAgIH0sXG4gICAgICBrZXlHZW5lcmF0b3I6IGFzeW5jIHJlcXVlc3QgPT4ge1xuICAgICAgICBpZiAocm91dGUuem9uZSA9PT0gUGFyc2UuU2VydmVyLlJhdGVMaW1pdFpvbmUuZ2xvYmFsKSB7XG4gICAgICAgICAgcmV0dXJuIHJlcXVlc3QuY29uZmlnLmFwcElkO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRva2VuID0gcmVxdWVzdC5pbmZvLnNlc3Npb25Ub2tlbjtcbiAgICAgICAgaWYgKHJvdXRlLnpvbmUgPT09IFBhcnNlLlNlcnZlci5SYXRlTGltaXRab25lLnNlc3Npb24gJiYgdG9rZW4pIHtcbiAgICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJvdXRlLnpvbmUgPT09IFBhcnNlLlNlcnZlci5SYXRlTGltaXRab25lLnVzZXIgJiYgdG9rZW4pIHtcbiAgICAgICAgICBpZiAoIXJlcXVlc3QuYXV0aCkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBoYW5kbGVQYXJzZVNlc3Npb24ocmVxdWVzdCwgbnVsbCwgcmVzb2x2ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAocmVxdWVzdC5hdXRoPy51c2VyPy5pZCAmJiByZXF1ZXN0LnpvbmUgPT09ICd1c2VyJykge1xuICAgICAgICAgICAgcmV0dXJuIHJlcXVlc3QuYXV0aC51c2VyLmlkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVxdWVzdC5jb25maWcuaXA7XG4gICAgICB9LFxuICAgICAgc3RvcmU6IHJlZGlzU3RvcmUuc3RvcmUsXG4gICAgfSksXG4gICAgY2xvdWQsXG4gIH0pO1xuICBDb25maWcucHV0KGNvbmZpZyk7XG59O1xuXG4vKipcbiAqIERlZHVwbGljYXRlcyBhIHJlcXVlc3QgdG8gZW5zdXJlIGlkZW1wb3RlbmN5LiBEdXBsaWNhdGVzIGFyZSBkZXRlcm1pbmVkIGJ5IHRoZSByZXF1ZXN0IElEXG4gKiBpbiB0aGUgcmVxdWVzdCBoZWFkZXIuIElmIGEgcmVxdWVzdCBoYXMgbm8gcmVxdWVzdCBJRCwgaXQgaXMgZXhlY3V0ZWQgYW55d2F5LlxuICogQHBhcmFtIHsqfSByZXEgVGhlIHJlcXVlc3QgdG8gZXZhbHVhdGUuXG4gKiBAcmV0dXJucyBQcm9taXNlPHt9PlxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJvbWlzZUVuc3VyZUlkZW1wb3RlbmN5KHJlcSkge1xuICAvLyBFbmFibGUgZmVhdHVyZSBvbmx5IGZvciBNb25nb0RCXG4gIGlmIChcbiAgICAhKFxuICAgICAgcmVxLmNvbmZpZy5kYXRhYmFzZS5hZGFwdGVyIGluc3RhbmNlb2YgTW9uZ29TdG9yYWdlQWRhcHRlciB8fFxuICAgICAgcmVxLmNvbmZpZy5kYXRhYmFzZS5hZGFwdGVyIGluc3RhbmNlb2YgUG9zdGdyZXNTdG9yYWdlQWRhcHRlclxuICAgIClcbiAgKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICB9XG4gIC8vIEdldCBwYXJhbWV0ZXJzXG4gIGNvbnN0IGNvbmZpZyA9IHJlcS5jb25maWc7XG4gIGNvbnN0IHJlcXVlc3RJZCA9ICgocmVxIHx8IHt9KS5oZWFkZXJzIHx8IHt9KVsneC1wYXJzZS1yZXF1ZXN0LWlkJ107XG4gIGNvbnN0IHsgcGF0aHMsIHR0bCB9ID0gY29uZmlnLmlkZW1wb3RlbmN5T3B0aW9ucztcbiAgaWYgKCFyZXF1ZXN0SWQgfHwgIWNvbmZpZy5pZGVtcG90ZW5jeU9wdGlvbnMpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbiAgLy8gUmVxdWVzdCBwYXRoIG1heSBjb250YWluIHRyYWlsaW5nIHNsYXNoZXMsIGRlcGVuZGluZyBvbiB0aGUgb3JpZ2luYWwgcmVxdWVzdCwgc28gcmVtb3ZlXG4gIC8vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgdG8gbWFrZSBpdCBlYXNpZXIgdG8gc3BlY2lmeSBwYXRocyBpbiB0aGUgY29uZmlndXJhdGlvblxuICBjb25zdCByZXFQYXRoID0gcmVxLnBhdGgucmVwbGFjZSgvXlxcL3xcXC8kLywgJycpO1xuICAvLyBEZXRlcm1pbmUgd2hldGhlciBpZGVtcG90ZW5jeSBpcyBlbmFibGVkIGZvciBjdXJyZW50IHJlcXVlc3QgcGF0aFxuICBsZXQgbWF0Y2ggPSBmYWxzZTtcbiAgZm9yIChjb25zdCBwYXRoIG9mIHBhdGhzKSB7XG4gICAgLy8gQXNzdW1lIG9uZSB3YW50cyBhIHBhdGggdG8gYWx3YXlzIG1hdGNoIGZyb20gdGhlIGJlZ2lubmluZyB0byBwcmV2ZW50IGFueSBtaXN0YWtlc1xuICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXRoLmNoYXJBdCgwKSA9PT0gJ14nID8gcGF0aCA6ICdeJyArIHBhdGgpO1xuICAgIGlmIChyZXFQYXRoLm1hdGNoKHJlZ2V4KSkge1xuICAgICAgbWF0Y2ggPSB0cnVlO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG4gIGlmICghbWF0Y2gpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cbiAgLy8gVHJ5IHRvIHN0b3JlIHJlcXVlc3RcbiAgY29uc3QgZXhwaXJ5RGF0ZSA9IG5ldyBEYXRlKG5ldyBEYXRlKCkuc2V0U2Vjb25kcyhuZXcgRGF0ZSgpLmdldFNlY29uZHMoKSArIHR0bCkpO1xuICByZXR1cm4gcmVzdFxuICAgIC5jcmVhdGUoY29uZmlnLCBhdXRoLm1hc3Rlcihjb25maWcpLCAnX0lkZW1wb3RlbmN5Jywge1xuICAgICAgcmVxSWQ6IHJlcXVlc3RJZCxcbiAgICAgIGV4cGlyZTogUGFyc2UuX2VuY29kZShleHBpcnlEYXRlKSxcbiAgICB9KVxuICAgIC5jYXRjaChlID0+IHtcbiAgICAgIGlmIChlLmNvZGUgPT0gUGFyc2UuRXJyb3IuRFVQTElDQVRFX1ZBTFVFKSB7XG4gICAgICAgIHRocm93IG5ldyBQYXJzZS5FcnJvcihQYXJzZS5FcnJvci5EVVBMSUNBVEVfUkVRVUVTVCwgJ0R1cGxpY2F0ZSByZXF1ZXN0Jyk7XG4gICAgICB9XG4gICAgICB0aHJvdyBlO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBpbnZhbGlkUmVxdWVzdChyZXEsIHJlcykge1xuICByZXMuc3RhdHVzKDQwMyk7XG4gIHJlcy5lbmQoJ3tcImVycm9yXCI6XCJ1bmF1dGhvcml6ZWRcIn0nKTtcbn1cblxuZnVuY3Rpb24gbWFsZm9ybWVkQ29udGV4dChyZXEsIHJlcykge1xuICByZXMuc3RhdHVzKDQwMCk7XG4gIHJlcy5qc29uKHsgY29kZTogUGFyc2UuRXJyb3IuSU5WQUxJRF9KU09OLCBlcnJvcjogJ0ludmFsaWQgb2JqZWN0IGZvciBjb250ZXh0LicgfSk7XG59XG4iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQXFDO0FBRTlCLE1BQU1B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