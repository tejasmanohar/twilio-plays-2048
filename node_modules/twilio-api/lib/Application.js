var url = require('url'),
	qs = require('querystring'),
	crypto = require('crypto'),
	tls = require('tls'),
	util = require('util'),
	utilFuncs = require('./util'),
	EventEmitter = require('events').EventEmitter,
	Call = require('./Call'),
	SMSMessage = require('./SMSMessage'),
	Tag = require('./Tag');
function Application(account, Sid) {
	this._account = account;
	this._client = account._client;
	this.Sid = Sid;
	this._pendingCalls = {}; //indexed by sid
	this._pendingSMSMessages = {}; //indexed by sid
	this._nextConf = 0;
	EventEmitter.call(this); //Make `this` a new EventEmitter
};
util.inherits(Application, EventEmitter); //Inherit all EventEmitter prototype methods
module.exports = Application;

Application.mutableProps = ['FriendlyName', 'ApiVersion', 'VoiceUrl', 'VoiceMethod', 'VoiceFallbackUrl',
	'VoiceFallbackMethod', 'StatusCallback', 'StatusCallbackMethod', 'VoiceCallerIdLookup',
	'SmsUrl', 'SmsMethod', 'SmsFallbackUrl', 'SmsFallbackMethod', 'SmsStatusCallback'];
Application.prototype._getResourceURI = function(type) {
	if(type == "create" || type == "list")
		return this._account._getResourceURI(type);
	else
		return this._account._getResourceURI(type) + '/Applications/' + this.Sid;
}
Application.prototype.load = utilFuncs.globalLoad;
Application.prototype.save = utilFuncs.globalSave;
Application.prototype.remove = function() {
	this.unregister();
	utilFuncs.globalDelete.apply(this, arguments);
}
Application.prototype.register = function() {
	var valid = Application.validateApplication(this);
	if(valid !== true)
		throw new Error("This application cannot be registered because required fields " +
			"are missing or invalid. Hint: Check the `" + valid + "` field.");
	if(this._client._appMiddleware[this.Sid] == undefined)
	{
		this._client._appMiddleware[this.Sid] = this.middleware();
		this._client._appMiddlewareSids.push(this.Sid);
	}
}
Application.prototype.unregister = function() {
	if(this._client._appMiddleware[this.Sid] != undefined)
	{
		var index = this._client._appMiddlewareSids.indexOf(this.Sid);
		this._client._appMiddlewareSids.splice(index, 1);
		delete this._client._appMiddleware[this.Sid];
	}
}

/*static*/ Application.validateApplication = function(appInfo) {
	var required = ['FriendlyName', 'VoiceUrl', 'StatusCallback', 'SmsUrl', 'SmsStatusCallback'];
	var reqMethods = ['VoiceMethod', 'StatusCallbackMethod', 'SmsMethod'];
	for(var i in required)
		if(typeof appInfo[required[i]] != 'string' || appInfo[required[i]].length <= 0)
			return required[i];
	for(var i in reqMethods)
		if(appInfo[reqMethods[i]] == null || appInfo[reqMethods[i]].toUpperCase() != 'GET')
			appInfo[reqMethods[i]] = 'POST';
	return true;
};

Application.prototype.listCalls = utilFuncs.globalList("Calls", Call);
Application.prototype.listSMSMessages = utilFuncs.globalList("SMS/Messages", SMSMessage);

/**
	makeCall(fromNumber, toNumber, [options, cb])
	options include:
		-sendDigits
		-ifMachine
		-timeout (defaults to 40 seconds, or roughly 6 rings)
	cb(err, call) is called when the call is queued.
	You may operate on the `call` Object using TwiML verbs, which will be executed when
	the call is answered.
	If `cb` is omitted, the call will be treated like an incoming call
*/
Application.prototype.makeCall = function(fromNumber, toNumber, options, cb) {
	if(typeof options == "function")
	{
		cb = options;
		options = undefined;
	}
	if(options == null)
		options = {};
	var app = this,
		data = {
			'ApplicationSid': app.Sid,
			//The following line is there because of a bug within Twilio. I am working with them to get it resolved. :)
			'StatusCallback': app.StatusCallback,
			'From': fromNumber,
			'To': toNumber,
			'Timeout': 40 //changed from API spec default of 60 seconds
		};
	if(options.sendDigits) data.SendDigits = options.sendDigits;
	if(options.ifMachine) data.IfMachine = options.ifMachine;
	if(options.timeout) data.Timeout = options.timeout;
	app._client._restAPI('POST', this._getResourceURI("create") + "/Calls", data, function(err, res) {
		if(err) return cb(err);
		var call = new Call(app, res.body.Sid).load(res.body);
		cb(null, call);
		app._pendingCalls[call.Sid] = call; //Add to queue
		call._queuedOutboundCall = true;
	});
}

Application.prototype.sendSMS = function(fromNumber, toNumber, body, cb) {
	var app = this,
		data = {
			'ApplicationSid': app.Sid,
			'From': fromNumber,
			'To': toNumber,
			'Body': body
		};
	app._client._restAPI('POST', this._getResourceURI("create") + "/SMS/Messages", data, function(err, res) {
		if(err) return cb(err);
		var sms = new SMSMessage(app, res.body.Sid).load(res.body);
		cb(null, sms);
		app._pendingSMSMessages[sms.Sid] = sms; //Add to queue
	});
}
/*Application.prototype.getRandomConference = function() {
	return {
		"name":	"rand:" + (_nextConf++) + ":" + Math.floor(Math.random() * 1e6);
	};
}
Application.prototype.bridgeCalls = function(c1, c2) {
	if(typeof c1 == "string")
		c1 = this._pendingCalls[c1];
	if(!(c1 instanceof Call) )
		throw new Error("You must specify two call Objects or call Sids");
	if(typeof c2 == "string")
		c2 = this._pendingCalls[c2];
	if(!(c2 instanceof Call) )
		throw new Error("You must specify two call Objects or call Sids");
	
}*/
Application.prototype.middleware = function() {
	var app = this;
	return function(req, res, next) {
		var protocol = (req.protocol || (req.app instanceof tls.Server ? "https" : "http")) + ':';
		var voiceURL = url.parse(app.VoiceUrl, false, true),
			voiceStatus = url.parse(app.StatusCallback, false, true),
			smsURL = url.parse(app.SmsUrl, false, true),
			smsStatus = url.parse(app.SmsStatusCallback, false, true),
			reqURL = url.parse(protocol + "//" + req.headers['host'] + req.url, true, true);
		function match(testURL, testMethod) {
			return (reqURL.hostname == testURL.hostname &&
				reqURL.pathname == testURL.pathname &&
				req.method.toUpperCase() == testMethod.toUpperCase() );
		};
		function parseData(cb) {
			/* Parses the body of a POST request, parses the querystring and checks the
			signature of the incoming message. */
			var data = {},
				sig = protocol + "//" + req.headers['host'] + req.url;
			if(req.method == 'POST' && !req.body)
			{
				//Manual parsing... just in case...
				var buf = '';
				req.on('data', function(chunk) {buf += chunk;});
				req.on('end', function() {
					try {
						req.body = buf.length > 0 ? qs.parse(buf) : {};
						afterBodyParser();
					} catch(err) {console.log(err); return cb(err);}
				});
			}
			else
				afterBodyParser();
			function afterBodyParser()
			{
				//Merge req.body into data and continue building signature string
				if(req.body)
				{
					var keys = Object.keys(req.body);
					keys.sort();
					for(var i = 0; i < keys.length; i++)
					{
						data[keys[i]] = req.body[keys[i]];
						sig += keys[i] + req.body[keys[i]];
					}
				}
				//Merge req.query into data
				if(!req.query)
					req.query = reqURL.query || {};
				for(var i in req.query)
					data[i] = req.query[i];
				//Now check the signature of the message
				var hmac = crypto.createHmac("sha1", app._client.AuthToken);
				hmac.update(sig);
				sig = hmac.digest("base64");
				if(sig !== req.headers['x-twilio-signature'])
					cb(new Error("HMAC-SHA1 signatures do not match!") );
				else
					cb(null, data);
			}
		}
		
		/* ------------- BEGIN TWILIO LOGIC ---------------- */
		if(match(voiceURL, app.VoiceMethod) )
			parseData(function(err, data) {
				if(err || data == null) return next(err);
				if(data.CallSid == null) return next(new Error("Missing CallSid") );
				//Refactor call object
				data.Sid = data.CallSid;
				delete data.CallSid;
				data.Status = data.CallStatus;
				delete data.CallStatus;
				
				//console.log("/voice has been called for call " + data.Sid);
				if(app._pendingCalls[data.Sid] != null)
				{
					//Matched queued outgoing call
					var call = app._pendingCalls[data.Sid];
					//Update call object
					for(var i in data)
						if(i != "cb" && i != "cbtype")
							call[i] = data[i];
					//Emit events about the call
					if(data.cb)
					{
						if(call._cb[data.cb])
						{
							switch(data.cbtype)
							{
								case 'dial':
									call._cb[data.cb](call, data.DialCallStatus,
										data.DialCallSid, data.DialCallDuration);
									break;
								case 'gather':
									call._cb[data.cb](call, data.Digits);
									break;
								case 'record':
									call._cb[data.cb](call, data.RecordingUrl,
										data.RecordingDuration, data.Digits);
									break;
								case 'transcribe':
									call._cb[data.cb](call, data.TranscriptionStatus,
										data.TranscriptionText, data.TranscriptionUrl,
										data.RecordingUrl);
									break;
								case 'liveCb':
									call._cb[data.cb](null, call);
									break;
								case 'cb':
								default:
									call._cb[data.cb](call);
									break;
							}
							if(data.cbtype === "transcribe")
							{
								res.statusCode = 200;
								res.end();
							}
							else
								call._handle(res);
							delete call._cb[data.cb]; //Garbage collection, which probably isn't needed
						}
						else
							next(new Error("Callback " + data.cb + " was not found for call " +
								data.Sid) );
					}
					//Could be a queued outbound call
					else if(call._queuedOutboundCall === true)
					{
						delete call._queuedOutboundCall;
						app.emit('outgoingCall', call);
						call.emit('connected', call.Status);
						call._handle(res);
					}
					else
						next(new Error("Request for pending call " + data.Sid +
							" did not specify a callback") );
				}
				else
				{
					var call = new Call(app, data.Sid);
					call.load(data);
					app._pendingCalls[data.Sid] = call;
					app.emit('incomingCall', call);
					call.emit('connected', call.Status);
					call._handle(res);
				}
			});
		else if(match(voiceStatus, app.StatusCallbackMethod) )
			parseData(function(err, data) {
				if(err || data == null) return next(err);
				if(data.CallSid == null) return next(new Error("Missing CallSid") );
				//Refactor call object
				data.Sid = data.CallSid;
				delete data.CallSid;
				data.Status = data.CallStatus;
				delete data.CallStatus;
				
				//console.log("/voiceStatus has been called for call " + data.Sid);
				if(app._pendingCalls[data.Sid] != null)
				{
					//Matched queued outgoing call
					var call = app._pendingCalls[data.Sid];
					//Update call object
					for(var i in data)
						call[i] = data[i];
					//Delete it from _pendingCalls
					delete app._pendingCalls[data.Sid];
					//Emit events
					call.emit('ended', call.Status, call.CallDuration);
					//Respond
					res.statusCode = 200;
					res.end();
				}
				else
					next(new Error("Twilio submitted call status for a call that does not exist.") );
			});
		else if(match(smsURL, app.SmsMethod) )
		{
			parseData(function(err, data) {
				if(err || data == null) return next(err);
				if(data.SmsSid == null) return next(new Error("Missing SmsSid") );
				//Refactor SMS Message object
				data.Sid = data.SmsSid;
				delete data.SmsSid;
				data.Status = data.SmsStatus;
				delete data.SmsStatus;
				
				//console.log("/sms has been called for SMS Message " + data.Sid);
				var sms = new SMSMessage(app, data.Sid);
				sms.load(data);
				app.emit('incomingSMSMessage', sms);
				
				//Respond with empty TwiML
				res.statusCode = 200;
				res.setHeader('content-type', 'application/xml');
				var twiml = new Tag('Response').toString();
				res.setHeader('content-length', twiml.length);
				res.end(twiml);
			});
		}
		else if(match(smsStatus, 'POST') )
		{
			parseData(function(err, data) {
				if(err || data == null) return next(err);
				if(data.SmsSid == undefined) return next(new Error("Missing SmsSid") );
				//Refactor SMS Message object
				data.Sid = data.SmsSid;
				delete data.SmsSid;
				data.Status = data.SmsStatus;
				delete data.SmsStatus;
				
				//console.log("/smsStatus has been called for SMS Message " + data.Sid);
				if(app._pendingSMSMessages[data.Sid] != undefined)
				{
					//Matched queued outgoing SMS
					var sms = app._pendingSMSMessages[data.Sid];
					//Update SMS object
					for(var i in data)
						sms[i] = data[i];
					//Delete it from _pendingSMSMessages
					delete app._pendingSMSMessages[data.Sid];
					//Emit events
					app.emit('outgoingSMSMessage', sms);
					sms.emit('sendStatus', sms.Status == "sent", sms.Status);
					//Respond
					res.statusCode = 200;
					res.end();
				}
				else
					next(new Error("Twilio submitted SMS status for a SMS Message that does not exist.") );
			});
		}
		else
			next();
	};
}
