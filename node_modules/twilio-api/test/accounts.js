var twilio = require('../lib'),
	client,
	Account = require('../lib/Account')
	basicTest = require('./basics');

exports.getTwilioCredentials = basicTest.getTwilioCredentials;
exports.constructClient = function() {
	client = basicTest.constructClient.apply(this, arguments);
}

exports.getMainAccountDetails = function(t) {
	t.expect(6);
	client.account.load(function(err, account) {
		t.ifError(err);
		t.ok(account != null, "Account object is " + account);
		if(account)
		{
			t.ok(account == client.account, "Account Objects do not match");
			t.ok(account.AuthToken == client.AuthToken, "Account token does not match");
			t.ok(client.AccountSid == account.Sid, "Account Sid does not match");
			t.ok(account.Status == 'active', "Account is not active?");
		}
		t.done();
	});
}

var subAccountName = "Testing 2878373748734872";
exports.createSubAccount = function(t) {
	t.expect(5);
	client.createSubAccount(subAccountName, function(err, account) {
		t.ifError(err);
		t.ok(account != null, "Account object is " + account);
		if(account)
		{
			t.ok(account != client.account, "Account is the same as main account");
			t.ok(account.FriendlyName == subAccountName, "Account friendly name does not match");
			t.ok(account.Status == 'active', "Account is not active?");
		}
		t.done();
	});
}

var subAccount;
exports.getSubAccountByFriendlyName = function(t) {
	t.expect(4);
	client.listAccounts({'FriendlyName': subAccountName, 'Status': 'active'}, function(err, li) {
		t.ifError(err);
		t.ok(li.Accounts.length == 1, "Multiple sub accounts with testing FriendlyName");
		t.ok(li.Accounts[0] instanceof Account, "Not an instance of Account class");
		subAccount = li.Accounts[0];
		t.ok(subAccount.Status == 'active', "Account is not active?");
		t.done();
	});
}

exports.closeSubAccount = function(t) {
	t.expect(4);
	if(subAccount)
		subAccount.closeAccount(function(err) {
			t.ifError(err);
			t.ok(subAccount.Status == 'closed', "Account is not closed");
			subAccount.load(function(err) {
				t.ifError(err);
				//Double-check...
				t.ok(subAccount.Status == 'closed', "Account is not closed");
				t.done();
			});
		});
}