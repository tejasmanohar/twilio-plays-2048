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
exports.sendSMS = function(t) {
	var credentials = client.credentials;
	if(credentials.FromNumber && credentials.ToNumber)
	{
		t.expect(4);
		console.log("Sending SMS to " + credentials.ToNumber);
		tapp.sendSMS(credentials.FromNumber, credentials.ToNumber, "This is only a test. Reply with text 'got it'", function(err, sms) {
			t.ifError(err);
			sms.on('sendStatus', function(success, status) {
				console.log("SMS Sent?", success, ":", status);
				t.ok(success);
			});
			tapp.on('incomingSMSMessage', function(sms) {
				t.equal(sms.From, credentials.ToNumber);
				t.equal(sms.Body, "got it");
				t.equal(sms.Status, "received");
				t.done();
			});
		});
	}
	else t.done();
}

exports.stopServer = function(t) {
	http.close();
	t.done();
}
