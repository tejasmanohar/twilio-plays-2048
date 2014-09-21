const API_VERSION = '2010-04-01';
const API_HOST = 'api.twilio.com';
var debug = process.env.NODE_ENV == "development";
if(debug) debug = function() {
	process.stdout.write("\033[36m");
	console.log.apply(this, arguments);
	process.stdout.write("\033[0m");
};

var https = require('https'),
	qs = require('querystring'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter,
	Account = require('./Account'),
	utilFuncs = require('./util');

/** Constructs a new Twilio client.
	Your AccountSid and AuthToken are on the Twilio Account Dashboard page.
	Access the main Twilio Account using the `account` property on the Client.
	@param accountSID - your Twilio account ID
	@param authToken - secret authorization token
*/
function Client(AccountSid, AuthToken) {
	this._client = this; //This is a hack to make global utiltiy functions work
	this.AccountSid = AccountSid;
	this.AuthToken = AuthToken;
	this.account = new Account(this, AccountSid);
	this._getCache = {};
	this._appMiddlewareSids = [];
	this._appMiddleware = {}; //indexed by Sid
};
module.exports = Client;
Client.prototype._getResourceURI = function(type) {
	return '/' + API_VERSION;
}
/** Returns an Account object on which you can perform Twilio API calls. If `cb`
	is set, then the details for this Account are also retrieved.
	@param sid - the Account Sid
	@param cb - (optional) the callback to be called once the subaccount details
		have been loaded. `cb` should be of the form: `cb(err, subaccount)`
	@return an Account object (before details have been retrieved)
*/
Client.prototype.getAccount = utilFuncs.globalGet(Account);
/** Creates a subaccount and returns the Account object to your callback function.
	@param friendlyName - (optional) the name of the subaccount to be created
	@param cb - the callback to be called once the subaccount has been created.
	`cb` should be of the form: `cb(err, subaccount)`
*/
Client.prototype.createSubAccount = utilFuncs.globalCreate('Accounts', Account,
	[], ['FriendlyName']);

/** Filters may include 'FriendlyName' or 'Status'.
*/
Client.prototype.listAccounts = utilFuncs.globalList('Accounts', Account);

/** Returns Express middleware to direct incoming Twilio requests to the
	appropriate Application instance.
	@return an Express-style middleware function of the form: `function(req, res, next)`
*/
Client.prototype.middleware = function() {
	var cli = this;
	return function(req, res, next) {
		var keys = cli._appMiddlewareSids;
		var i = 0;
		(function nextMiddleware(err) {
			if(err) return next(err); //abort!
			if(i < keys.length)
				cli._appMiddleware[keys[i++]](req, res, nextMiddleware);
			else
				next();
		})();
	}
};
/** Main REST API function.
	@param method - a string indicating which HTTP verb to use (i.e. GET, POST, etc.)
	@param command - the REST command to be sent (part of the URL path)
	@param data - (optional) an Object to be sent. In a POST, PUT, or DELETE request, this
		string is urlencoded and appended to the HTTP request body. In other
		requests (i.e. GET), the string is appended to the URL.
	@param cb - (optional) a callback executed when Twilio's server responds to the HTTP request.
		cb should be of the form: `cb(err, res)` where `err` is an Error object and `res` is
		the 
	"Weak" HTTP Caching is implemented for GET requests, but its performance is rather poor.
	Also Note: This function prefers to parse JSON responses, not XML responses; however,
		this function maps the JSON property names (lowercase and separate by underscores)
		up with the XML tag names (in CamelCase). Rather silly that Twilio made their JSON
		responses that way, but... no worries. :)
*/
Client.prototype._restAPI = function(method, command, data, cb) {
	var cli = this;
	//optional args
	if(typeof data == "function") {
		cb = data;
		data = undefined;
	}
	//TODO: Make caching a bit better than this...
	if(Math.random() > 0.995)
		cli._getCache = {}; //clear cache
	//Build command, headers, and method type
	command += ".json";
	if(data == null)
		data = '';
	else
		data = qs.stringify(data);
	var headers = {};
	if(method == 'POST' || method == 'PUT' || method == 'DELETE')
	{
		headers['content-type'] = 'application/x-www-form-urlencoded';
		headers['content-length'] = data.length;
	}
	else
	{
		method = 'GET';
		if(data != '')
			command += '?' + data;
		if(cli._getCache[command] != undefined)
			headers['if-modified-since'] = new Date(
				cli._getCache[command].headers['last-modified']).toUTCString();
	}
	//Make HTTPS request
	var req = https.request({
		'host': API_HOST,
		'port': 443,
		'method': method,
		'path': command,
		'headers': headers,
		'auth': cli.AccountSid + ':' + cli.AuthToken
	}, function(res) {
		if(!cb) return;
		var resBody = '';
		res.on('data', function(chunk) {
			resBody += chunk;
		});
		res.on('end', function() {
			if(debug)
			{
				var color = getColor(res.statusCode);
				debug("REST API Request:", method, req.path, method == 'POST' ? data : '',
				"-\033[" + color + "m", res.statusCode + "\033[90m");
			}
			//Weak caching
			if(res.statusCode == 304)
				cb(null, cli._getCache[command]);
			//Error handling
			else if(res.statusCode >= 400)
			{
				if(debug) debug("\033[" + color + "m\t\t  Response Body:", resBody + "\033[90m");
				cb(new Error("An error occurred for command: " + method + " " + command +
					"\n\t" + API_HOST + " responded with status code " + res.statusCode), res);
			}
			else
			{
				//Weak caching
				if(method == 'GET' && res.headers['last-modified'])
					cli._getCache[command] = res;
				try {
					if(resBody == '')
						res.body = {};
					else
						res.body = JSON.parse(resBody); //may throw exception
					//JSON responses look different than XML responses... stupid
					utilFuncs.underscoresToCamelCase(res.body);
				} catch(e) {return cb(e);}
				cb(null, res);
			}
		});
	});
	req.on('error', cb);
	//Send POST data
	if(method == 'POST' || method == 'PUT')
		req.end(data);
	else
		req.end();
};
function getColor(statusCode) {
	var color = 32;
	if (statusCode >= 500) color = 31;
	else if (statusCode >= 400) color = 33;
	else if (statusCode >= 300) color = 36;
	return color;
}
