var twilio = require('../lib'),
	credentials,
	client,
	Application = require('../lib/Application'),
	Call = require('../lib/Call');

exports.getTwilioCredentials = function(t) {
	t.expect(3);
	try {
		credentials = require('./credentials');
		t.equal(typeof credentials.AccountSid, "string", "Credentials object missing 'AccountSid' property");
		t.equal(typeof credentials.AuthToken, "string", "Credentials object missing 'AuthToken' property");
		t.equal(typeof credentials.ApplicationSid, "string", "Credentials object missing 'ApplicationSid' property");
		t.done();
	}
	catch(e) {
		console.log("Twilio Credentials not found");
		console.log("To prevent this prompt, create a 'credentials.js' file that exports\n" +
			" your AccountSid and AuthToken.");
		var readline = require('readline');
		var input = readline.createInterface(process.stdin, process.stdout, null);
		input.question("Please enter your Twilio Account Sid: ", function(accountSid) {
			input.question("Please enter your Twilio Auth Token: ", function(authToken) {
				console.log("Please be certain that your Twilio Application is pointing to this server. The test suite server will listen on port 8002.");
				input.question("Please enter a valid Twilio Application Sid for this account: ",
					function(appSid) {
					input.pause();
					process.stdin.pause();
					credentials = {'AccountSid': accountSid, 'AuthToken': authToken, 'ApplicationSid': appSid};
					t.equal(typeof credentials.AccountSid, "string", "Credentials object missing 'AccountSid' property");
					t.equal(typeof credentials.AuthToken, "string", "Credentials object missing 'AuthToken' property");
					t.equal(typeof credentials.ApplicationSid, "string", "Credentials object missing 'ApplicationSid' property");
					t.done();
				});
			});
		});
	}
}
exports.constructClient = function(t) {
	t.expect(2);
	client = new twilio.Client(credentials.AccountSid, credentials.AuthToken);
	client.credentials = credentials; //Expose this object for the sake of other tests
	t.ok(client.AccountSid == credentials.AccountSid, "Account Sid does not match credentials");
	t.ok(client.account.Sid == credentials.AccountSid, "account.Sid does not match credentials");
	t.done();
	return client;
}

exports.listAvailableLocalNumbers = function(t) {
	t.expect(5);
	client.account.listAvailableLocalNumbers('US', {
		'AreaCode': 614 //Woot! C-bus! Represent, yo!
	}, function(err, li) {
		t.ifError(err);
		if(li)
		{
			t.ok(li.AvailablePhoneNumbers instanceof Array, "Not an array");
			t.ok(li.AvailablePhoneNumbers.length > 0, "Hmm... no numbers in Columbus?");
			if(li.AvailablePhoneNumbers.length > 0)
			{
				t.ok(li.AvailablePhoneNumbers[0].Region == 'OH', "Not in Ohio?");
				t.ok(li.AvailablePhoneNumbers[0].IsoCountry == 'US', "Not in US?  Say what?");
				t.done();
			}
		}
	});
}

exports.listAvailableTollFreeNumbers = function(t) {
	t.expect(5);
	client.account.listAvailableTollFreeNumbers('US', {
		'AreaCode': 866
	}, function(err, li) {
		t.ifError(err);
		if(li)
		{
			t.ok(li.AvailablePhoneNumbers instanceof Array, "Not an array");
			t.ok(li.AvailablePhoneNumbers.length > 0, "Hmm... toll free numbers?");
			if(li.AvailablePhoneNumbers.length > 0)
			{
				t.ok(li.AvailablePhoneNumbers[0].PhoneNumber.substr(0, 5) == '+1866', "Does not match filter");
				t.ok(li.AvailablePhoneNumbers[0].IsoCountry == 'US', "Not in US?  Say what?");
			}
		}
		t.done();
	});
}

var appName = "Testing 2789278973974982738478";
exports.createApplicationFail = function(t) {
	t.expect(1);
	t.throws(function() {
		client.account.createApplication(1, 2, 3, 4, 5, function() {}, 6, 7, 8, 9, 10, function() {});
	});
	t.done();
}

var createdApp;
const URL_PREFIX = 'https://www.example.com/twilio/';
exports.createApplication = function(t) {
	t.expect(4);
	client.account.createApplication(URL_PREFIX + 'voice', 'POST', URL_PREFIX + 'voiceStatus', 'POST',
		URL_PREFIX + 'sms', 'POST', URL_PREFIX + 'smsStatus', appName, function(err, app) {
		t.ifError(err);
		if(app)
		{
			t.ok(app instanceof Application, "Not an Application");
			t.ok(app.FriendlyName == appName, "FriendlyName does not match");
			t.ok(app.AccountSid == client.account.Sid, "Account Sid does not match");
			createdApp = app;
		}
		t.done();
	});
}

exports.listApplications = function(t) {
	t.expect(5);
	client.account.listApplications(function(err, li) {
		t.ifError(err);
		if(li)
		{
			t.ok(li.Applications instanceof Array, "Not an array");
			t.ok(li.Applications.length > 0, "Hmm... no applications?");
			t.ok(li.Results instanceof Array, "Should also have property Results");
			t.ok(li.Results === li.Applications, "Should be the same Object");
		}
		t.done();
	});
}

exports.getApplication = function(t) {
	t.expect(4);
	client.account.getApplication(createdApp.Sid, function(err, app) {
		t.ifError(err);
		t.ok(app instanceof Application, "Not instanceof Application");
		t.ok(app != createdApp, "Ensure it's a different instance");
		t.ok(app.FriendlyName == appName, "FriendlyName does not match");
		t.done();
	});
}

exports.testApplicationRegistration = function(t) {
	t.expect(14);
	var app = createdApp;
	t.equal(client._appMiddlewareSids.length, 0);
	t.equal(Object.keys(client._appMiddleware).length, 0);
	app.register();
	t.equal(client._appMiddlewareSids.length, 1);
	t.equal(client._appMiddlewareSids[0], app.Sid);
	t.equal(Object.keys(client._appMiddleware).length, 1);
	t.equal(typeof client._appMiddleware[app.Sid], "function");
	app.register();
	t.equal(client._appMiddlewareSids.length, 1);
	t.equal(client._appMiddlewareSids[0], app.Sid);
	t.equal(Object.keys(client._appMiddleware).length, 1);
	t.equal(typeof client._appMiddleware[app.Sid], "function");
	app.unregister();
	t.equal(client._appMiddlewareSids.length, 0);
	t.equal(Object.keys(client._appMiddleware).length, 0);
	app.unregister();
	t.equal(client._appMiddlewareSids.length, 0);
	t.equal(Object.keys(client._appMiddleware).length, 0);
	t.done();
}

exports.listCalls = function(t) {
	t.expect(4);
	createdApp.listCalls(function(err, li) {
		t.ifError(err);
		if(li)
		{
			t.ok(li.Calls instanceof Array, "List is not an array?");
			t.ok(li.Calls.length > 0, "List is empty");
			t.ok(li.Calls[0] instanceof Call, "List item is not a Call object");
		}
		t.done();
	});
}

exports.removeApplication = function(t) {
	t.expect(3);
	createdApp.remove(function(err, success) {
		t.ifError(err);
		t.ok(success, "Delete failed");
		client.account.getApplication(createdApp.Sid, function(err, app) {
			t.ok(err != null && app == null, "Should be an error");
			t.done();
		});
	});
}
