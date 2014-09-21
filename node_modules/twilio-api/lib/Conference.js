var utilFuncs = require('./util');

function Conference(app, Sid) {
	this._app = app;
	this._client = app._client;
	this._parent = app._account;
}
module.exports = Conference;

Conference.prototype._getResourceURI = function(type) {
	return this._parent._getResourceURI(type) + '/Conferences/' + this.Sid;
}
Conference.prototype.load = utilFuncs.globalLoad;
Conference.prototype.save = utilFuncs.globalSave;
