var util = require('util'),
	EventEmitter = require('events').EventEmitter,
	utilFuncs = require('./util'),
	Tag = require('./Tag');
function Call(app, Sid) {
	this._app = app;
	this._parent = app._account;
	this._client = app._client;
	this.twiml = new Tag('Response');
	this._cb = {}; //Indexed by callback ID
	this._cbID = 0;
	EventEmitter.call(this); //Make `this` a new EventEmitter
};
Call.mutableProps = ['Url', 'Method', 'Status'];
util.inherits(Call, EventEmitter); //Inherit all EventEmitter prototype methods
module.exports = Call;

Call.prototype._getResourceURI = function(type) {
	return this._parent._getResourceURI(type) + '/Calls/' + this.Sid;
}
Call.prototype.load = utilFuncs.globalLoad;
Call.prototype.save = utilFuncs.globalSave;
Call.prototype.liveCancel = function(cb) {
	this.Status = 'canceled';
	this.save(cb);
}
Call.prototype.liveHangUp = function(cb) {
	this.Status = 'completed';
	this.save(cb);
}
Call.prototype.liveRedirect = function(url, method, cb) {
	this.Url = url;
	this.Method = method;
	delete this.Status;
	this.save(cb);
	delete this.Url;
	delete this.Method;
}
Call.prototype.liveCb = function(cb) {
	this._cb[this._cbID] = cb;
	this.liveRedirect(this._app.VoiceUrl + "?cbtype=liveCb&cb=" + encodeURIComponent(this._cbID),
		this._app.VoiceMethod, function(err, obj) {
			if(err) cb(err);
		});
	this._cbID++;
}

function Gather() {
	this.twiml = new Tag("Gather");
};

//-- Call prototype
Call.prototype._handle = function(res) {
	res.statusCode = 200;
	res.setHeader('content-type', 'application/xml');
	var twiml = this.twiml.toString();
	res.setHeader('content-length', twiml.length);
	res.end(twiml);
	this.twiml = new Tag('Response'); //Reset TwiML for next _handle call
	if(this._cbID >= 2147483647) this._cbID = 0; //Just in case... :)
};
/* Uses the TwiML <Redirect> Verb to redirect call flow to your callback
	Useful espeically following a <Gather> Verb that might fall-through due to no input
*/
Call.prototype.cb = function(cb) {
	this._cb[this._cbID] = cb;
	this.redirect(this._app.VoiceUrl + "?cbtype=cb&cb=" +
		encodeURIComponent(this._cbID), this._app.VoiceMethod);
	this._cbID++;
}
/* TwiML <Say> Verb */
function _say(rootTag, text, options) {
	if(options == null) options = {};
	if(text.length > 4000)
		throw new Error("You cannot say more than 4000 characters of text. This is a Twilio limitation.");
	var say = new Tag("Say");
	say.append(text)
		.setAttribute('voice', options.voice)
		.setAttribute('language', options.language)
		.setAttribute('loop', options.loop);
	rootTag.append(say);
}
/*TwiML <Play> Verb */
function _play(rootTag, audioUrl, options) {
	if(options == null) options = {};
	var play = new Tag("Play");
	play.append(audioUrl)
		.setAttribute('loop', options.loop);
	rootTag.append(play);
}
/* TwiML <Pause> Verb */
function _pause(rootTag, pauseDuration) {
	var pause = new Tag("Pause");
	pause.setAttribute('length', pauseDuration);
	rootTag.append(pause);
}
Call.prototype.say = function(text, options) {
	_say(this.twiml, text, options);
}
Call.prototype.play = function(audioUrl, options) {
	_play(this.twiml, audioUrl, options);
}
Call.prototype.pause = function(pauseDuration) {
	_pause(this.twiml, pauseDuration);
}
/* TwiML <Gather> Verb
	Gathers input from the telephone user's keypad.
	Calls `cbIfInput` if input is provided.
	Options include:
		-timeout
		-finishOnKey
		-numDigits
	If no input was provided by the user, a couple of things may happen:
		-If cbIfNoInput was set, call `cbIfNoInput`;
		-Otherwise, proceed to the next TwiML instruction
*/
Call.prototype.gather = function(cbIfInput, options, cbIfNoInput) {
	if(typeof options == "function") {
		cbIfNoInput = options;
		options = null;
	}
	if(options == null) options = {};
	this._cb[this._cbID] = cbIfInput;
	var gather = new Gather();
	gather.twiml
		.setAttribute('action', this._app.VoiceUrl + "?cbtype=gather&cb=" +
			encodeURIComponent(this._cbID) )
		.setAttribute('method', this._app.VoiceMethod)
		.setAttribute('timeout', options.timeout)
		.setAttribute('finishOnKey', options.finishOnKey)
		.setAttribute('numDigits', options.numDigits);
	this.twiml.append(gather.twiml);
	this._cbID++;
	if(typeof cbIfNoInput == "function")
		this.cb(cbIfNoInput);
	return gather;
}
/* TODO: TwiML <Record> Verb */
Call.prototype.record = function(cb, options, cbIfEmptyRecording) {
	if(typeof options == "function") {
		cbIfEmptyRecording = options;
		options = null;
	}
	if(options == null) options = {};
	if(options.transcribe === false)
		options.transcribeCallback = null;
	else if(typeof options.transcribeCallback == "function")
		options.transcribe = true;
	this._cb[this._cbID] = cb;
	var record = new Tag("Record");
	record
		.setAttribute('action', this._app.VoiceUrl + "?cbtype=record&cb=" +
			encodeURIComponent(this._cbID) )
		.setAttribute('method', this._app.VoiceMethod)
		.setAttribute('timeout', options.timeout)
		.setAttribute('maxLength', options.maxLength)
		.setAttribute('transcribe', options.transcribe)
		.setAttribute('playBeep', options.playBeep);
	this._cbID++;
	if(typeof options.transcribeCallback == "function")
	{
		this._cb[this._cbID] = options.transcribeCallback;
		record.setAttribute('transcribeCallback', this._app.VoiceUrl + "?cbtype=transcribe&cb=" +
			encodeURIComponent(this._cbID) );
		this._cbID++;
	}
	this.twiml.append(record);
	if(typeof cbIfEmptyRecording == "function")
		this.cb(cbIfEmptyRecording);
}
/* TwiML <Sms> Verb */
//Not implemented
/* TwiML <Dial> Verb
Dials the specified callees and calls cbAfterDial when the callee hangs up or dial fails.
`callees` can be:
	-Phone number - a string in E.164 format
	-Phone number - object with properties:
		-number - in E.164 format
		-sendDigits
		-CAUTION: The `url` option is not implemented, and will likely not be implemented.
			You can achieve this functionality by briding calls using conferences.
			See call.bridge(...)
	-Twilio Client ID - an object with properties:
		-client - the Twilio Client name
	-Conference - an object with properties:
		-name
		-muted
		-beep
		-startConferenceOnEnter
		-startConferenceOnExit
		-waitUrl - waitUrl and waitMethod may point to an audio file to <Play> or a TwiML document
			that uses <Play> or <Say> for content
		-waitMethod - be sure to use GET if requesting audio files (so caching works)
		-maxParticipants
	-An array of any of these
`options` include:
	-timeout - How long to wait for callee to answer (defaults to 30 seconds)
	-hangupOnStar - (defaults to false)
	-timeLimit - maximum duration of the call (defaults to 4 hours)
	-callerID (a valid phone number or client identifier, if calling a Twilio Client only)
If you specify `cbAfterDial`, it will be called when the dialed user
*/
/*Call.prototype.dial = function(callees, options, cbAfterDial) {
	if(typeof options == "function") {
		cbAfterDial = options;
		options = null;
	}
	if(options == null) options = {};
	this._cb[this._cbID] = cbAfterDial;
	var dial = new Tag("Dial");
	dial
		.setAttribute('action', this._app.VoiceUrl + "?cbtype=dial&cb=" +
			encodeURIComponent(this._cbID) )
		.setAttribute('method', this._app.VoiceMethod)
		.setAttribute('timeout', options.timeout)
		.setAttribute('hangupOnStar', options.hangupOnStar)
		.setAttribute('timeLimit', options.timeLimit)
		.setAttribute('callerId', options.callerId);
	if(!(callees instanceof Array) )
		callees = [callees];
	var noun;
	for(var i in callees)
	{
		if(typeof callees[i] == "object")
		{
			if(callees[i].number)
			{
				noun = new Tag("Number");
				noun.append(callees[i].number)
					.setAttribute("sendDigits", callees[i].sendDigits);
				dial.append(noun);
			}
			else if(callees[i].client)
			{
				noun = new Tag("Client");
				client.append(callees[i].client);
				dial.append(noun);
			}
			else if(callees[i].name)
			{
				//Assume this is a conference
				noun = new Tag("Conference");
				noun.append(callees[i].name)
					.setAttribute("muted", callees[i].muted)
					.setAttribute("beep", callees[i].beep)
					.setAttribute("startConferenceOnEnter", callees[i].startConferenceOnEnter)
					.setAttribute("endConferenceOnExit", callees[i].endConferenceOnExit)
					.setAttribute("waitUrl", callees[i].waitUrl)
					.setAttribute("waitMethod", callees[i].waitMethod)
					.setAttribute("maxParticipants", callees[i].maxParticipants);
				dial.append(noun);
			}
		}
		else if(typeof callees[i] == "string")
		{
			noun = new Tag("Number");
			noun.append(callees[i]);
			dial.append(noun);
		}
	}
	this.twiml.append(dial);
	this.twiml._done = true; //No more TwiML should be added
	this._cbID++;
}*/
Call.prototype.joinConference = function(roomName, options, cbOnEnd) {
	if(typeof roomName != "string")
	{
		cbOnEnd = options;
		options = roomName;
		roomName = this._parent.getRandomConferenceRoomName();
	}
	if(typeof options == "function")
	{
		cbOnEnd = options;
		options = null;
	}
	if(options == null) options = {};
	var dial = new Tag("Dial");
	dial
		.setAttribute('hangupOnStar', options.leaveOnStar)
		.setAttribute('timeLimit', options.timeLimit);
	var conf = new Tag("Conference");
	conf
		.append(roomName)
		.setAttribute('muted', options.muted)
		.setAttribute('beep', options.beep)
		.setAttribute('startConferenceOnEnter', options.startConferenceOnEnter)
		.setAttribute('endConferenceOnExit', options.endConferenceOnExit)
		.setAttribute('waitUrl', options.waitUrl)
		.setAttribute('waitMethod', options.waitMethod)
		.setAttribute('maxParticipants', options.maxParticipants);
	dial.append(conf);
	this.twiml.append(dial);
	if(typeof cbOnEnd == "function")
	{
		this._cb[this._cbID] = cbOnEnd;
		dial.setAttribute('action', this._app.VoiceUrl + "?cbtype=dial&cb=" +
				encodeURIComponent(this._cbID) )
			.setAttribute('method', this._app.VoiceMethod);
		this._cbID++;
		this.twiml._done = true;
	}
	return roomName;
}
/* Special case of joinConference() */
Call.prototype.putOnHold = function(options) {
	return this.joinConference({
		'timeLimit': options.timeLimit,
		'beep': options.beep || false,
		'waitUrl': options.waitUrl,
		'waitMethod': options.waitMethod
	});
}
/* Special case of joinConference() */
Call.prototype.putOnHoldWithoutMusic = function(options) {
	return this.joinConference({
		'timeLimit': options.timeLimit,
		'beep': options.beep || false,
		'waitUrl': ''
	});
}
/* TwiML <Hangup> Verb */
Call.prototype.hangup = function() {
	this.twiml.append(new Tag("Hangup") );
	this.twiml._done = true; //No more TwiML should be added
}
/* TwiML <Redirect> Verb
	Useful for redirecting calls to another Twilio application
*/
Call.prototype.redirect = function(url, method) {
	
	var redirect = new Tag("Redirect");
	redirect.append(url)
		.setAttribute('method', method);
	this.twiml.append(redirect);
	this.twiml._done = true; //No more TwiML should be added
}
/* TwiML <Reject> Verb
	Rejects a call without incurring any fees.
	This MUST be the first item in your TwiML and is only valid for
	incoming calls.
*/
Call.prototype.reject = function(reason) {
	if(this.twiml.content != undefined)
		throw new Error("The reject instruction must be the first instruction.");
	var reject = new Tag("Reject");
	if(reason == "rejected" || reason == "busy")
		reject.setAttribute('reason', reason);
	this.twiml.append(reject);
	this.twiml._done = true; //No more TwiML should be added
}

//-- Gather prototype
Gather.prototype.say = function(text, options) {
	_say(this.twiml, text, options);
}
Gather.prototype.play = function(audioUrl, options) {
	_play(this.twiml, audioUrl, options);
}
Gather.prototype.pause = function(pauseDuration) {
	_pause(this.twiml, pauseDuration);
}
