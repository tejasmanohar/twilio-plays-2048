var utilFuncs = require('./util'),
	ListIterator = require('./ListIterator'),
	Application = require('./Application'),
	AvailablePhoneNumber = require('./AvailablePhoneNumber');

function Account(client, Sid) {
	this._client = client;
	this.Sid = Sid;
	this._conferences = {};
}
module.exports = Account;
Account.mutableProps = ['FriendlyName', 'Status'];
Account.prototype._getResourceURI = function(type) {
	return this._client._getResourceURI(type) + '/Accounts/' + this.Sid;
}
Account.prototype.load = utilFuncs.globalLoad;
Account.prototype.save = utilFuncs.globalSave;
Account.prototype.closeAccount = function(cb) {
	this.Status = 'closed';
	this.save(cb);
}
Account.prototype.suspendAccount = function(cb) {
	this.Status = 'suspended';
	this.save(cb);
}
Account.prototype.activateAccount = function(cb) {
	this.Status = 'active';
	this.save(cb);
}

/** Query Twilio for available local numbers
	@param countryCode - Country code in ISO 3166-1 alpha-2 format
	@param filters - (optional) An object containing any of these properties:
		* AreaCode
		* Contains - A pattern to match phone numbers on. Valid characters are '*'
			and [0-9a-zA-Z]. The '*' character will match any single digit. 
		
		### These filters are limited to US and Canadian phone numbers:
		* InPostalCode - Limit results to a particular postal code.
		* InRegion - Works in US/Canada only. Filters by 2-character province/state code
		* NearLatLong - Given a latitude/longitude pair lat,long find geographically
			close numbers within Distance miles.
		* NearNumber - Given a phone number, find a geographically close number within
			Distance miles.
		* InLata - Limit results to a specific Local access and transport area (LATA).
		* InRateCenter - Limit results to a specific rate center, or given a phone number
			search within the same rate center as that number. Requires InLata to be set as well.
		* Distance - Specifies the search radius for a Near- query in miles.
			If not specified this defaults to 25 miles.
	@param callback - `cb(err, listIterator)`
*/
Account.prototype.listAvailableLocalNumbers = function(countryCode, filters, cb) {
	var func = utilFuncs.globalList("AvailablePhoneNumbers/" +	countryCode + "/Local",
		AvailablePhoneNumber);
	return func.call(this, filters, cb);
}

/** Query Twilio for available toll-free numbers
	@param countryCode - Country code in ISO 3166-1 alpha-2 format
	@param filters - (optional) An object containing any of these properties:
		* AreaCode
		* Contains - A pattern to match phone numbers on. Valid characters are '*'
			and [0-9a-zA-Z]. The '*' character will match any single digit.
	@param callback - `cb(err, listIterator)`
*/
Account.prototype.listAvailableTollFreeNumbers = function(countryCode, filters, cb) {
	var func = utilFuncs.globalList("AvailablePhoneNumbers/" +	countryCode + "/TollFree",
		AvailablePhoneNumber);
	return func.call(this, filters, cb);
}


Account.prototype.getApplication = utilFuncs.globalGet(Application);
Account.prototype.listApplications = utilFuncs.globalList("Applications", Application);
Account.prototype.createApplication = utilFuncs.globalCreate("Applications", Application,
	['VoiceUrl', 'VoiceMethod', 'StatusCallback', 'StatusCallbackMethod', 'SmsUrl', 'SmsMethod',
		'SmsStatusCallback'], ['FriendlyName']);

Account.prototype.getRandomConferenceRoomName = function() {
	return "Rand_" + new Date().getTime() + ":" + Math.random(); //good enough for now
}