Add voice and SMS messaging capabilities to your Node.JS applications with node-twilio-api!

# node-twilio-api

A high-level Twilio helper library to make Twilio API requests, handle incoming requests,
and generate TwiML.

Also ships with Connect/Express middleware to handle incoming Twilio requests.

**IMPORTANT**: You will need a Twilio account to get started (it's not free). [Click here to sign up for 
an account](https://www.twilio.com/try-twilio)

## Install

Project Status: Stable

`npm install twilio-api`

This project is rather stable. Both placing and receiving calls works rather well.
You can also send/receive SMS messages. For anything else, see the docs below to see if your
feature is supported.

## Features and Library Overview

 - [Create Twilio client](#createClient)
 - [Manage accounts and subaccounts](#manageAccts)
 - [List available local and toll-free numbers](#listNumbers)
 - [Manage Twilio applications](#applications)
 - [Place calls](#placingCalls)
 - [Receive calls](#incomingCallEvent)
 - [List calls and modify live calls](#listAndModifyCalls)
 - [Generate TwiML responses](#generatingTwiML) without writing any XML (I don't like XML).
 - [Conferences, Briding Calls, etc](#joinConference)
 - [Send SMS Messages](#send-sms-messages)
 - [Receive SMS Messages](#incomingSMSMessageEvent)
 - [List and Manage SMS Messages](#list-and-manage-sms-messages)
 - [Built-in pagination with ListIterator Object](#listIterator)

## Todo

 - List and manage valid outgoing phone numbers
 - List and provision incoming phone numbers
 - Support for Twilio Connect Applications
 - List and manage conferences, conference details, and participants
 - List SMS short codes and details
 - Respond to fallback URLs
 - Better scalability with multiple Node instances
	- An idea for this is to intercept incoming Twilio requests only if the message is for
	that specific instance. Perhaps use URL namespacing or cookies for this?
 - Access recordings, transcriptions, and notifications *(Support is limited at this time)*

## Basic Usage

1. Create a Client using your Account SID and Auth Token.
2. Load or create a Twilio application and point the VoiceUrl, SmsUrl, etc. to your Node.JS server.
3. Add the `client.middleware()` to your Express/Connect stack. Start your server.
	Call `app.register()` to register your application with the middleware.
4. Use `app.makeCall` to place calls
5. Use `app.on('incomingCall', function(call) {...} );` to handle inbound calls.
6. Generate TwiML by calling methods on the Call object directly.

```javascript
var express = require('express'),
    app = express.createServer();
var twilioAPI = require('twilio-api'),
	cli = new twilioAPI.Client(ACCOUNT_SID, AUTH_TOKEN);
app.use(cli.middleware() );
app.listen(PORT_NUMBER);
//Get a Twilio application and register it
cli.account.getApplication(APPLICATION_SID, function(err, app) {
	if(err) throw err;
	app.register();
	app.on('incomingCall', function(call) {
		//Use the Call object to generate TwiML
		call.say("This is a test. Goodbye!");
	});
	app.makeCall("+12225551234", "+13335551234", function(err, call) {
		if(err) throw err;
		call.on('connected', function(status) {
			//Called when the caller picks up
			call.say("This is a test. Goodbye!");
		});
		call.on('ended', function(status, duration) {
			//Called when the call ends
		});
	});
});
/*
... more sample code coming soon...
For now, check the /tests folder
*/
```

## API

The detailed documentation for twilio-api follows.

#### <a name="createClient"></a>Create Twilio client

Easy enough...

```javascript
var twilioAPI = require('twilio-api');
var cli = new twilioAPI.Client(AccountSid, AuthToken);
```

#### <a name="middleware"></a>Create Express middleware

- `Client.middleware()` - Returns Connect/Express middleware that handles any request for 
*registered applications*. A registered application will then handle the request accordingly if
the method (GET/POST) and URL path of the request matches the application's VoiceUrl,
StatusCallback, SmsUrl, or SmsStatusCallback.

Could this be much easier?

```javascript
var express = require('express'),
    app = express.createServer();
var twilioAPI = require('twilio-api'),
	cli = new twilioAPI.Client(AccountSid, AuthToken);
//OK... good so far. Now tell twilio-api to intercept incoming HTTP requests.
app.use(cli.middleware() );
//OK... now we need to register a Twilio application
cli.account.getApplication(ApplicationSid, function(err, app) {
	if(err) throw err; //Maybe do something else with the error instead of throwing?
	
	/* The following line tells Twilio to look at the URL path of incoming HTTP requests
	and pass those requests to the application if it matches the application's VoiceUrl/VoiceMethod,
	SmsUrl/SmsMethod, etc. As of right now, you need to create a Twilio application to use the
	Express middleware. */
	app.register();
});
```

Oh, yes.  The middleware also uses your Twilio AuthToken to validate incoming requests,
[as described here](http://www.twilio.com/docs/security#validating-requests). If your server is
running behind an HTTPS proxy, be sure that `req.protocol` contains the appropriate protocol. If
using Express 3.0, set the "trust proxy" option to ensure that `req.protocol` is populated with
the value in the `X-Forwarded-Proto` header.  For more information, checkout the
[`req.protocol` property](http://expressjs.com/api.html#req.protocol).

#### <a name="manageAccts"></a>Manage accounts and subaccounts

- `Client.account` - the main Account Object
- `Client.getAccount(Sid, cb)` - Get an Account by Sid. The Account Object is passed to the callback
	`cb(err, account)`
- `Client.createSubAccount([FriendlyName,] cb)` Create a subaccount, where callback is `cb(err, account)`
- `Client.listAccounts([filters,] cb)` - List accounts and subaccounts using the specified `filters`,
	where callback is `cb(err, li)` and `li` is a ListIterator Object.
	`filters` may include 'FriendlyName' and/or 'Status' properties.
- `Account.load([cb])` - Load the Account details from Twilio, where callback is `cb(err, account)`
- `Account.save([cb])` - Save the Account details to Twilio, where callback is `cb(err, account)`
- `Account.closeAccount([cb])` - Permanently close this account, where callback is `cb(err, account)`
- `Account.suspendAccount([cb])` - Suspend this account, where callback is `cb(err, account)`
- `Account.activateAccount([cb])` - Re-activate a suspended account, where callback is `cb(err, account)`

#### <a name="listNumbers"></a>List available local and toll-free numbers

- `Account.listAvailableLocalNumbers(countryCode, [filters,] cb)` - List available local telephone
numbers in your `countryCode` available for provisioning using the provided `filters` Object.
See [Twilio's documentation](http://www.twilio.com/docs/api/rest/available-phone-numbers#local)
for what filters you can apply. `cb(err, li)` where `li` is a ListIterator.
- `Account.listAvailableTollFreeNumbers(countryCode, [filters,] cb)` - List available toll-free
numbers in your `countryCode` available for provision using the provided `filters` Object.
See [Twilio's documentation](http://www.twilio.com/docs/api/rest/available-phone-numbers#toll-free)
for what filters you can apply. `cb(err, li)` where `li` is a ListIterator.

#### <a name="applications"></a>Applications

- `Account.getApplication(Sid, cb)` - Get an Application by Sid. The Application Object is passed to
	the callback `cb(err, app)`
- `Account.createApplication(voiceUrl, voiceMethod, statusCb, statusCbMethod,
	smsUrl, smsMethod, smsStatusCb, [friendlyName], cb)` - Creates an Application with
		`friendlyName`, where callback is `cb(err, app)`
		The `VoiceUrl`, `voiceMethod` and other required arguments are used to intercept incoming
		requests from Twilio using the provided Connect middleware. These URLs should point to the same
		server instance as the one running, and you should ensure that they do not interfere with
		the namespace of your web application.
		**CAUTION: It is highly recommended that you use 'POST' as the method for all requests;
		otherwise, strange behavior may occur.**
- `Account.listApplications([filters,] cb)` - List applications associated with this Account.
	`filters` may include a 'FriendlyName' property. Callback is of the form: `cb(err, li)`
- `Application.load([cb])`
- `Application.save([cb])`
- `Application.remove([cb])` - Permanently deletes this Application from Twilio, where callback
	is `cb(err, success)` and `success` is a boolean.
- `Application.register()` - Registers this application to intercept the appropriate HTTP requests
	using the [Connect/Express middleware](#middleware). The application must provide a VoiceUrl,
	VoiceMethod, StatusCallback, StatusCallbackMethod, SmsUrl, SmsMethod, and SmsStatusCallback;
	otherwise, an exception will be thrown.
- `Application.unregister()` - Unregisters this application. This happens automatically if the
	application is deleted.

A valid application must have a VoiceUrl, VoiceMethod, StatusCallback, StatusCallbackMethod,
SmsUrl, SmsMethod, and SmsStatusCallback.  Fallback URLs are ignored at this time.

#### <a name="placingCalls"></a>Placing Calls

- `Application.makeCall(from, to, [options, cb])` - Place a call and call the callback once the
	call is queued. If your application is registered, but your VoiceUrl is not set to the same
	server, the callee will likely receive an error message, and a debug error will be logged on
	your account. For example, if your server is running at www.example.com, please ensure that
	your VoiceUrl is something like: http://www.example.com/twilio/voice
	Also, be sure that your VoiceUrl protocol matches your protocol (HTTP vs. HTTPS).
	
`from` is the phone number or client identifier to use as the caller id. If using a phone number,
	it must be a Twilio number or a verified outgoing caller id for your account.

`to` is the phone number or client identifier to call.

`options` is an object containing any of these additional properties:
	
- sendDigits - A string of keys to dial after connecting to the number. Valid digits in the string
	include: any digit (0-9), '#', '*' and 'w' (to insert a half second pause).
- ifMachine - Tell Twilio to try and determine if a machine (like voicemail) or a human has answered
	the call. Possible values are 'Continue', 'Hangup', and null (the default).
	Answering machine detection is an experimental feature, and support is limited. The downside of
	trying to detect a machine is that Twilio needs to listen to the first few seconds of audio after
	connecting a call. This usually results in a few seconds of delay before Twilio begins processing
	TwiML. If your application does not care about the human vs. machine distinction, then omit the
	'ifMachine' option, and Twilio will perform no such analysis.
- timeout - The integer number of seconds that Twilio should allow the phone to ring before assuming
	there is no answer. Default is 60 seconds, the maximum is 999 seconds.

`cb` - Callback of the form `cb(err, call)`. This is called as soon as the call is queued, *not when
	the call is connected*.
	You can being building your TwiML response in the context of this callback, or you can listen for
	the various events on the Call Object.

Phone numbers should be formatted with a '+' and country code e.g., +16175551212 (E.164 format).

#### <a name="listAndModifyCalls"></a>List Calls and Modify Live Calls

- `Application.listCalls([filters,] cb)` - Lists live and completed calls associated with an Account.
	Note: you must call Application.listCalls, not Account.listCalls.  This is a side-effect
	caused by the Application and Call being very inter-related.
	Refer to the [Twilio Documentation](http://www.twilio.com/docs/api/rest/call#list-get) to see
	what `filters` you can use. Again, callback is of the form: `cb(err, li)`.
- `Call.load([cb])`
- `Call.save([cb])`
- `Call.liveCancel([cb])` - will attempt to hangup this call if it is queued or ringing, but not
	affect the call if it is already in progress.
- `Call.liveHangUp([cb])` - will attempt to hang up this call even if it's already in progress.
- `Call.liveRedirect(url, method)` - Transfers control of this call **immediately** to the TwiML at
	the specified URL. Note: this is quite different from `Call.redirect`, which should be used when TwiML
	is being served to Twilio.
- `Call.liveCb(cb)` - Will use the `Call.liveRedirect` function to **immediately** re-route control to
	the specified callback function, `cb`. The `cb` must be of the form `cb(err, call)`. Please
	ensure that the Call is associated with a registered application for this to work properly.

#### <a name="generatingTwiML"></a>Generating TwiML

Generating TwiML is as simple as calling methods on the Call Object.  To make things simple, you
cannot generate TwiML for SMS requests, only voice requests.

Let's look at an example of placing and handling an outbound call:

```javascript
/* Make sure that you have already setup your Twilio client, loaded and registered a valid application,
	and started your server. Twilio must be able to contact your server for this to work. Ensure that your
	server is running, proper ports are open on your firewall, etc.
*/
app.makeCall("+16145555555", "+16145558888", function(err, call) {
	if(err) throw err;
	//Now we can use the call Object to generate TwiML and listen for Call events
	call.on('connected', function(status) {
		/* This is called as soon as the call is connected to 16145558888 (when they answer)
			Note: status is probably 'in-progress' at this point.
			Now we generate TwiML for this call... which will served up to Twilio when the
			call is connected.
		*/
		call.say("Hello. This is a test of the Twilio API.");
		call.pause();
		var gather = call.gather(function(call, digits) {
			call.say("You pressed " + digits + ".");
			var str = "Congratulations! You just used Node Twilio API to place an outgoing call.";
			call.say(str, {'voice': 'man', 'language': 'en'});
			call.pause();
			call.say(str, {'voice': 'man', 'language': 'en-gb'});
			call.pause();
			call.say(str, {'voice': 'woman', 'language': 'en'});
			call.pause();
			call.say(str, {'voice': 'woman', 'language': 'en-gb'});
			call.pause();
			call.say("Goodbye!");
		}, {
			'timeout': 10,
			'numDigits': 1
		});
		gather.say("Please press any key to continue. You may press 1, 2, 3, 4, 5, 6, 7, 8, 9, or 0.");
		call.say("I'm sorry. I did not hear your response. Goodbye!");
	});
	call.on('ended', function(status, duration) {
		/* This is called when the call ends and the StatusCallback is called.
			Note: status is probably 'completed' at this point. */
	});
});
```

### CAUTION: COMMON PITFALL:

DO NOT DO THE FOLLOWING:

```javascript
app.makeCall("+16145555555", "+16145558888", function(err, call) {
	if(err) throw err;
	//Now we can use the call Object to generate TwiML and listen for Call events
	call.on('connected', function(status) {
		//Using an asyncronous function call -- INCORRECT: this will not work as expected!
		fs.readFile('greeting.txt', function(err, data) {
			if(err) throw err;
			call.say(data); //At this point, the 'connected' event handler has already been executed
		});
		/* At this point, no TwiML has been generated yet, and we must serve something to Twilio.
			So, we serve an empty TwiML document.
		*/
	});
});
```

Notice that the 'connected' event completes before the file has been read. This means that Twilio
has already requested and received the TwiML for the call. The call will be answered by Twilio
and then immediately hung up (since no TwiML is provided).

Note: The above code will work, but your generated TwiML will not be executed until another Call event
is triggered.

See the [Common Pitfalls](https://github.com/bminer/node-twilio-api/wiki/Common-Pitfalls)
page on the wiki for futher details and solutions.

#### Here are all of the TwiML-generating functions you can call:

 - `Call.say(text[, options])` - Reads `text` to the caller using text to speech. Options include:
	- `voice` - 'man' or 'woman' (default: 'man')
	- `language` - allows you pick a voice with a specific language's accent and pronunciations.
		Allowed values: 'en', 'en-gb', 'es', 'fs', 'de' (default: 'en')
	- `loop` - specifies how many times you'd like the text repeated. The default is once.
		Specifying '0' will cause the &lt;Say&gt; verb to loop until the call is hung up.
 - `Call.play(audioUrl[, options])` - plays an audio file back to the caller. Twilio retrieves the
	file from a URL (`audioUrl`) that you provide. Options include:
	- `loop` - specifies how many times the audio file is played. The default behavior is to play the
		audio once. Specifying '0' will cause the the &lt;Play&gt; verb to loop until the call is hung up.
 - `Call.pause([duration])`	- waits silently for a `duration` seconds. If &lt;Pause&gt; is the first
	verb in a TwiML document, Twilio will wait the specified number of seconds before picking up the call.
 - `Call.gather(cbIfInput[, options, cbIfNoInput])` - Gathers input from the telephone user's keypad.
	Calls `cbIfInput` once the user provides input, passing the Call object as the first argument and
	the input provided as the second argument. If the user does not provide valid input in a timely
	manner, `cbIfNoInput` is called if it was provided; otherwise, the next TwiML instruction will
	be executed.  Options include:
	- `timeout` - The limit in seconds that Twilio will wait for the caller to press another digit
		before moving on. Twilio waits until completing the execution of all nested verbs before
		beginning the timeout period. (default: 5 seconds)
	- `finishOnKey` - When this key is pressed, Twilio assumes that input gathering is complete. For
		example, if you set 'finishOnKey' to '#' and the user enters '1234#', Twilio will
		immediately stop waiting for more input when the '#' is received and will call
		`cbIfInput`, passing the call Object as the first argument and the string "1234" as the second.
		The allowed values are the digits 0-9, '#' , '*' and the empty string (set 'finishOnKey' to '').
		If the empty string is used, &lt;Gather&gt; captures all input and no key will end the
		&lt;Gather&gt; when	pressed. (default: #)
	- `numDigits` - the number of digits you are expecting, and calls `cbIfInput` once the caller
		enters that number of digits.
	The `Call.gather()` function returns a Gather Object with methods: `say()`, `play()`, and `pause()`,
	allowing you to nest those verbs within the &lt;Gather&gt; verb.
 - `Call.record(cb[, options, cbIfEmptyRecording])` - records the caller's voice and returns to you the
	URL of a file containing the audio recording. Callback is called when the recording is complete
	and should be of the form: `cb(call, recordingUrl, recordingDuration, input)` where `call`
	is the Call object, `recordingUrl` is the URL that can be fetched to retrieve the recording,
	`recordingDuration` is the duration of the recording, and `input` is the key (if any) pressed
	to end the recording, or the string 'hangup' if the caller hung up. If the user does not speak
	during the recording, `cbIfEmptyRecording` is called if it was provided; otherwise, the next
	TwiML instruction will be executed.
	Options include:
	- `timeout` - tells Twilio to end the recording after a number of seconds of silence has
		passed. The default is 5 seconds.
	- `finishOnKey` - a set of digits that end the recording when entered. The allowed values are the
		digits 0-9, '#' and '*'. The default is '1234567890*#' (i.e. any key will end the recording).
	- `maxLength` - the maximum length for the recording in seconds. This defaults to 3600 seconds
		(one hour) for a normal recording and 120 seconds (two minutes) for a transcribed recording.
	- `transcribe` - tells Twilio that you would like a text representation of the audio of the recording.
		Twilio will pass this recording to our speech-to-text engine and attempt to convert the audio
		to human readable text. The 'transcribe' option is off by default. If you do not wish to
		perform transcription, simply do not include the transcribe attribute.
		**Transcription is a pay feature.** If you include a 'transcribe' or 'transcribeCallback'
		option, your account will be charged. See the pricing page for Twilio transcription prices.
	- `transcribeCallback` - a function that will be called when the transcription is complete.
		Callback should be of the form: `cb(call, transcriptionStatus, transcriptionText,
		transcriptionUrl, recordingUrl)`. TwiML generated on the Call object will not be executed until
		later because a transcribeCallback does not affect the call flow.
	- `playBeep` - play a sound before the start of a recording. If you set the value
		to 'false', no beep sound will be played. Defaults to true.
 - `Call.sms` - Not implemented, and probably will never be implemented. You can use
	`Application.sendSMS` to send SMS messages.
<a name="joinConference"></a>
 - `Call.joinConference([roomName, option, cbOnEnd])` - connects the call to a conference room. If
	`roomName` is not specified, the caller will be placed into a uniquely named, empty conference room.
	The name of the conference room into which the call is placed is returned by this function.
	`cbOnEnd` will be called when the call ends, if it is specified; otherwise, the next TwiML
	instruction will be executed when this conference ends. `cbOnEnd` should be of the form:
	`cb(call, status)`.  Please keep in mind that conferences do not start until at least two
	participants join; in the meantime, the caller must wait. In addition, a conference does not end
	until all callers drop out. This means that there are only a few ways to end a conference:
	
	- You press * and `leaveOnStar` is set.
	- `timeLimit` expires.
	- Someone leaves who had `endConferenceOnExit` set.
	- You end the conference manually using one of the `Conference` Object methods.
	
	Options include:
	
	- `leaveOnStar` - lets the calling party leave the conference room if '*' is pressed on the caller's
		keypad. Defaults to false.
	- `timeLimit` - the maximum duration of the conference in seconds.  By default, there is a four hour
		time limit set on calls.
	- `muted` - whether the caller can speak on the conference. If this attribute is set to 'true',
		the participant will only be able to listen to people on the conference. Defaults to 'false'.
	- `beep` - whether a notification beep is played to the conference when a participant joins or
		leaves the conference. Defaults to true.
	- `startConferenceOnEnter` - tells a conference to start when this participant joins the conference,
		if it is not already started. Defaults to true. If this is false and the participant joins a
		conference that has not started, they are muted and hear background music until a participant
		joins where `startConferenceOnEnter` is true.
	- `endConferenceOnExit` - ends the conference when this caller leaves, causing all other participants
		in the conference to drop out. Defaults to false.
	- `waitUrl` - a URL for music that plays before the conference has started. The URL may be an MP3,
		a WAV or a TwiML document that uses <Play> or <Say> for content. Defaults to
		'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical'. For more information,
		view the [Twilio Documentation]
		(http://www.twilio.com/docs/api/twiml/conference#attributes-waitUrl)
	- `waitMethod` - indicates which HTTP method to use when requesting 'waitUrl'. Defaults to 'POST'.
		Be sure to use 'GET' if you are directly requesting static audio files such as WAV or MP3 files
		so that Twilio properly caches the files.
	- `maxParticipants` - the maximum number of participants you want to allow within a named conference
		room. The default maximum number of participants is 40. The value must be a positive integer
		less than or equal to 40.
 - `Call.dial` - Not implemented, and probably will never be implemented.
	- You can use `Call.joinConference` to join a conference room.
	- You can use `Application.makeCall` to call other participants and tell them all to join a
		conference room.  This is the recommended way to bridge calls, for example.
 - `Call.putOnHold([options])` - A special case of `Call.joinConference`.  The call is placed into a
	random, empty conference room with the specified hold music. The conference room name is returned.
	Options include:
		- `timeLimit` - see `Call.joinConference()` above
		- `beep` - whether a notification beep is played to the conference when a participant joins or
		leaves the conference. Defaults to **false**. Note: this default is intentionally different from
		`Call.joinConference`
		- `waitUrl` - see `Call.joinConference()` above
		- `waitMethod` - see `Call.joinConference()` above
- `Call.putOnHoldWithoutMusic([options])` - A special case of `Call.joinConference`.  The call is placed into a
	random, empty conference room with no hold music. The conference room name is returned.
	Options include:
		- `timeLimit` - see `Call.joinConference()` above
		- `beep` - whether a notification beep is played to the conference when a participant joins or
		leaves the conference. Defaults to **false**. Note: this default is intentionally different from
		`Call.joinConference`
 - `Call.hangup()` - Ends a call. If used as the first verb in a TwiML response it does not prevent
	Twilio from answering the call and billing your account.
 - `Call.redirect(url, method)` - Transfers control of a call to the TwiML at a different URL.
	All verbs after &lt;Redirect&gt; are unreachable and ignored. Twilio will request a new TwiML document
	from `url` using the HTTP `method` provided.
 - `Call.reject([reason])` - rejects an incoming call to your Twilio number without billing you. This
	is very useful for blocking unwanted calls. **If and only if the first verb in a TwiML document is
	&lt;Reject&gt;,	Twilio will not pick up the call. This means `Call.reject()` must be called before any
	other TwiML-generating function. You cannot `Call.say()` and then `Call.reject()`**
	The call ends with a status of 'no-answer' or 'busy', depending on the `reason` provided.
	**Any verbs after &lt;Reject&gt; are unreachable and ignored.**
	Possible `reason`s include: 'rejected', 'busy' (default: 'rejected')
 - `Call.cb(cb)` - When reached, Twilio will use the &lt;Redirect&gt; verb to re-route control to the
	specified callback function, `cb`. The `cb` will be passed the Call object. This is useful if you
	want to loop like this:

	```javascript
	(function getInput() {
		call.gather(function(call, digits) {
			//Input received
		}).say("Please press 1, 2, or 3.");
		call.cb(getInput); //Loop until we get input
	})();
	```

#### <a name="callEvents"></a>Call Events

The following Call events are only emitted if the Call is associated with a registered Application.
See `app.register()` for more details.

- Event: 'connected' `function(status) {}` - Emitted when the call connects. For outbound calls,
	this event is only emitted when the callee answers the call. Use the 'ended' event below to
	determine why a call was not answered. For further information, refer to the
	[Twilio Documentation]
	(http://www.twilio.com/docs/api/twiml/twilio_request#request-parameters-call-status)
	for possible call status values.
	*EDIT:* I think the only possible call status value is 'in-progress'. See issue #3.
	
	Note: As described above, one must take care when using asynchronous function calls
	within the 'connected' event handler, as the callbacks for these async calls will be
	executed *after* the TwiML has already been submitted to Twilio. See [Common Pitfalls]
	(https://github.com/bminer/node-twilio-api/wiki/Common-Pitfalls) for details.
- Event: 'ended' `function(status, callDuration) {}` - Emitted when the call ends for whatever
	reason. For outbound calls, one can use this event to see why the call never connected
	(i.e. the person did not answer, the line was busy, etc.) See the [Twilio Documentation]
	(http://www.twilio.com/docs/api/twiml/twilio_request#request-parameters-call-status)
	for possible call status values.
	*EDIT:* I believe the only possible call status values are: `['completed', 'busy',
	'failed', 'no-answer', 'canceled']`. See issue #3.

#### <a name="appEvents"></a>Application Events

- Event: 'outgoingCall' `function(call) {}` - Emitted when Twilio connects an outgoing call
	placed with `Application.makeCall()`. It is not common to listen for this event.
- <a name="incomingCallEvent"></a>Event: 'incomingCall' `function(call) {}` - Emitted when the
	Twilio middleware receives a voice request from Twilio. Once you have the Call Object, you
	can [generate a TwiML response](#generatingTwiML) or listen for Call events.
- Event: 'outgoingSMSMessage' `function(smsMessage) {}` - Emitted when Twilio sends an outgoing
	SMS message sent with `Application.sendSMS()`. It is not common to listen for this event.
- <a name="incomingSMSMessageEvent"></a>Event: 'incomingSMSMessage' `function(smsMessage) {}` -
	Emitted when the Twilio middleware receives a SMS message request from Twilio.

#### Send SMS Messages

- `Application.sendSMS(from, to, body [, cb])` - Send a SMS Message to a SMS-enabled phone.
	If your application is registered, but your SmsStatusCallbackUrl is not set to the same server,
	the SMSMessage Object will not emit the 'sendStatus' event. For example, if your server
	is running at www.example.com, please ensure that your
	SmsStatusCallbackUrl is something like: http://www.example.com/twilio/smsStatus
	Also, be sure that your SmsStatusCallbackUrl protocol matches your protocol (HTTP vs. HTTPS).
	
`from` - A Twilio phone number enabled for SMS. Only phone numbers or short codes purchased from
	Twilio work here.

`to` - the destination phone number.

`body` - the body of the message you want to send, limited to 160 characters.

`cb` - Callback of the form `cb(err, smsMessage)`. This is called as soon as the message is
	queued to be sent, *not when the message is actually sent/delivered*. To check the message's
	send status, you can listen for the 'sendStatus' event on the SMSMessage Object.

Phone numbers should be formatted with a '+' and country code e.g., +16175551212 (E.164 format).

#### List and Manage SMS Messages

- `Application.listSMSMessages([filters,] cb)` - Lists inbound and outbound SMS Messages associated
	with an Account. Note: you must call Application.listSMSMessages, not Account.listSMSMessages.
	This is a side-effect caused by the Application and SMS Message being very inter-related.
	Refer to the [Twilio Documentation](http://www.twilio.com/docs/api/rest/sms#list-get) to see
	what `filters` you can use. Callback is of the form: `cb(err, li)`.
- `SMSMessage.load([cb])`
- `SMSMessage.reply(body [, cb])` - Calls `Application.sendSMS(this.To, this.From, body, cb)`
	internally. This method will not work from outbound SMS Messages.
- Useful SMS Properties include:
	- From - The phone number that sent this message
	- To - The phone number of the recipient
	- Body - The text body of the SMS message. Up to 160 characters long
	- Status - The status of this SMS message. Either queued, sending, sent, or failed.
	- Direction - The direction of this SMS message. 'incoming' for incoming messages,
		'outbound-api' for messages initiated via the REST API, 'outbound-call' for messages
		initiated during a call or 'outbound-reply' for messages initiated in response to an
		incoming SMS. At this time, node-twilio-api does not support 'outbound-call' or
		'outbound-reply'; all outbound SMS messages are marked 'outbound-api'.
	- Dates (i.e. DateCreated, DateSent)
	- Geographic information (i.e. FromCity, FromState, ..., ToZip, ToCountry)
	- Any others: http://www.twilio.com/docs/api/twiml/sms/twilio_request#synchronous

#### SMS Message Events

- Event: 'sendStatus' `function(success, status) {}` - Emitted when an outbound SMS message has been
	processed.  Success is either true or false; status is either "sent" or "failed".

#### <a name="listIterator"></a>ListIterator

A ListIterator Object is returned when Twilio reponses may be large. For example, if one were to list
all subaccounts, the list might be relatively lengthy.  For these responses, Twilio returns 20 or so
items in the list and allows us to access the rest of the list with another API call.  To simplify this
process, any API call that would normally return a list returns a ListIterator Object instead.

The ListIterator Object has several properties and methods:

- `Page` - A property of the ListIterator that tells you which page is loaded at this time
- `NumPages` - The number of pages in the resultset
- `PageSize` - The number of results per page (this can be changed and the default is 20)
- `Results` - The array of results. If results are a list of accounts, this will be an array of Account
	Objects, if it's a list of applications, this will be an array of Application Objects, etc.
- `nextPage([cb])` - Requests that the next page of results be loaded. Callback is of the form
	`cb(err, li)`
- `prevPage([cb])` - Requests that the previous page of results be loaded.

## Testing

twilio-api uses [nodeunit](https://github.com/caolan/nodeunit) right now for testing. To test the package,
run `npm test` in the root directory of the repository.

**BEWARE:** Running the test suite *may* actually place calls and cause you to incur fees on your Twilio
account. Please look through the test suite before running it.

## Disclaimer

Blake Miner is not affliated with Twilio, Inc. in any way.
Use this software AT YOUR OWN RISK. See LICENSE for more details.
