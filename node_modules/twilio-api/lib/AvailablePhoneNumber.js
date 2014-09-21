function AvailablePhoneNumber(account) {
	this._account = account;
	this._client = account._client;
}
module.exports = AvailablePhoneNumber;
/* This will eventually have methods like:
	- provisionNumber()
	or... whatever
*/