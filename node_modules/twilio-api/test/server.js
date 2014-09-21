var twilio = require('../lib'),
	basicTest = require('./basics'),
	client,
	express = require('express'),
	app = express.createServer(),
	http,
	tapp;

exports.getTwilioCredentials = basicTest.getTwilioCredentials;
exports.constructClient = function() {
	client = basicTest.constructClient.apply(this, arguments);
}

exports.setupExpressMiddleware = function(t) {
	t.expect(2);
	t.equal(typeof client.middleware, "function");
	t.equal(typeof express.errorHandler, "function");
	if(process.env.NODE_ENV == "development")
		app.use(function(req, res, next) {
			console.log("\033[46m\033[30m" + "Incoming request: " + req.method + " " + req.url + "\033[0m");
			next();
		});
	app.use(client.middleware() );
	app.use(express.errorHandler({
		'showMessage': true,
		'dumpExceptions': true
	}) );
	http = app.listen(8002);
	t.done();
}

exports.loadApplication = function(t) {
	t.expect(2);
	client.account.getApplication(client.credentials.ApplicationSid, function(err, app) {
		t.ifError(err);
		t.notEqual(app, null, "Application is null or undefined");
		tapp = app;
		t.done();
	});
}

exports.registerApplication = function(t) {
	t.expect(6);
	t.equal(client._appMiddlewareSids.length, 0);
	t.equal(Object.keys(client._appMiddleware).length, 0);
	tapp.register();
	t.equal(client._appMiddlewareSids.length, 1);
	t.equal(client._appMiddlewareSids[0], tapp.Sid);
	t.equal(Object.keys(client._appMiddleware).length, 1);
	t.equal(typeof client._appMiddleware[tapp.Sid], "function");
	t.done();
}

/* Place a call from caller ID credentials.FromNumber to credentials.ToNumber.
	Callee must pick up the phone and press a key for this test to be successful. */
exports.makeCall = function(t) {
	var credentials = client.credentials;
	if(credentials.FromNumber && credentials.ToNumber)
	{
		t.expect(4);
		console.log("Placing call to " + credentials.ToNumber);
		tapp.makeCall(credentials.FromNumber, credentials.ToNumber, {
			'timeout': 12
		}, function(err, call) {
			t.ifError(err);
			if(!err && call)
			{
				call.on('connected', function(status) {
					t.equal(status, 'in-progress', "connected event did not show in-progress status");
					console.log(new Date().toUTCString() + ": Call " + call.Sid +
						" has been connected: " + status);
				});
				call.say("Hello. This is a test of the Twilio API.");
				call.pause();
				var input = call.gather(function(call, digits) {
					t.ok(digits != '', "Caller did not press any key");
					call.say("You pressed " + digits + ".");
					var str = "Congratulations! You just used Node Twilio API to place an " +
						"outgoing call.";
					call.say(str, {'voice': 'man', 'language': 'en'});
					call.pause();
					var loop = 0;
					(function getInputLoop(call) {
						input = call.gather(function(call, digits) {
							if(digits.length == 10)
							{
								call.say("OK. I'm calling " + digits +
									". Please wait. Press * at any time to end this call.");
								var roomName = call.joinConference({
									'leaveOnStar': true,
									'timeLimit': 120,
									'endConferenceOnExit': true
								});
								call.say("The call has ended.");
								//Now call the other person
								tapp.makeCall(credentials.ToNumber, digits, {
									'timeout': 12
								}, function(err, call2)
								{
									function errorFunc(message) {
										return function(err, call) {
											if(err) t.ifError(err);
											else
											{
												call.say(message);
												call.say("Goodbye.");
											}
										};
									};
									if(err) call.liveCb(errorFunc("There was an error placing the call.") );
									call2.on('connected', function(status) {
										console.log("Call 2 connected:", status);
										if(status != 'in-progress')
											call.liveCb(errorFunc("Something weird happened. Sorry.") );
										else
										{
											call2.say("Hello. Please wait while I connect you to " +
												"your party.");
											call2.joinConference(roomName, {
												'endConferenceOnExit': true
											});
											call2.say("The call has ended. Thank you for participating " +
												"in the test. Goodbye.");
										}
									});
									call2.on('ended', function(status, duration) {
										console.log("Call 2 ended:", status, duration);
										switch(status)
										{
											case 'no-answer':
												call.liveCb(errorFunc("The caller did not answer.") );
												break;
											case 'busy':
												call.liveCb(errorFunc("The caller's line was busy.") );
												break;
											case 'failed':
												call.liveCb(errorFunc("There was an error placing the call.") );
												break;
											case 'completed':
												break;
											default:
												call.liveCb(errorFunc("Something weird happened. Call status was " + status) );
												break;
										}
									});
								});
							}
							else
								call.say("You entered " + digits.length +
									" digits, so I won't run the next test.");
							call.say("Goodbye!");
						}, {
							'timeout': 10,
							'finishOnKey': '#'
						});
						input.say("If you want to test calling another person, " +
							"please enter their telephone number followed by #. " +
							"Otherwise, you may hang up or simply press # to disconnect.");
						call.say("Sorry. I didn't hear your response.");
						//Only prompt for input 3 times, then just give up and hangup
						if(++loop <= 3)
							call.cb(getInputLoop);
						else
							call.say("Goodbye!");
					})(call);
				}, {
					'timeout': 10,
					'numDigits': 1
				});
				input.say("Please press any key to continue. " +
					"You may press 1, 2, 3, 4, 5, 6, 7, 8, 9, or 0.");
				call.say("I'm sorry. I did not hear your response. The test will fail. Goodbye!");
				call.on('ended', function(status, duration) {
					t.equal(status, 'completed', 'Call status was not completed in ended event');
					console.log(new Date().toUTCString() + ": Call " + call.Sid + " has ended: "
						+ status + ":" + duration + " seconds");
					t.done();
				});
			}
		});
	}
	else t.done();
}

exports.stopServer = function(t) {
	http.close();
	t.done();
}
