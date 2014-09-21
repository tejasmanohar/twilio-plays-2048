var ListIterator = require('./ListIterator');
exports.globalCreate = function(listResourceURI, objType, requiredFields, optionalFields) {
	if(requiredFields == null) requiredFields = [];
	if(optionalFields == null) optionalFields = [];
	return function() {
		var data = {}, cb;
		//Extract arguments
		for(var i = 0; i < arguments.length; i++)
		{
			if(typeof arguments[i] == "function")
			{
				cb = arguments[i];
				i++;
				break; //Stop! We are done processing arguments now
			}
			else if(i < requiredFields.length)
				data[requiredFields[i]] = arguments[i];
			//At this point, we've taken care of the required arguments. Now then...
			else if(typeof arguments[i] == "object")
			{
				/* If we have an object, just load the contents of the Object into `data`,
					assuming this argument is the list of optional fields */
				for(var j in optionalFields)
					data[optionalFields[j]] = arguments[i][optionalFields[j]];
			}
			else
				//Otherwise, just load optional fields one at a time into `data` until we hit `cb`
				data[optionalFields[i - requiredFields.length]] = arguments[i];
		}
		if(i <= requiredFields.length)
			throw new Error("Insufficient number of arguments passed when creating " + objType.name);
		if(cb == undefined) throw new Error("No callback was provided when creating " + objType.name);
		//API call
		var cli = this._client,
			theCaller = this;
		cli._restAPI('POST', this._getResourceURI("create") + "/" + listResourceURI, data, function(err, res) {
			if(err) return cb(err);
			cb(null, new objType(theCaller, res.body.Sid).load(res.body) );
		});
	}
}

/** List the set of objects of type `objType`.
	@param filters - (optional) the filter Object that allows you to limit the
		list returned.
	@param cb - a callback of the form `cb(err, listIterator)`
*/
exports.globalList = function(listResourceURI, objType) {
	//`this` refers to this module - do not use
	return function(filters, cb) {
		//now `this` refers to the proper thing
		if(typeof filters == "function")
		{
			cb = filters;
			filters = undefined;
		}
		var li = new ListIterator(this, this._getResourceURI("list") + "/" + listResourceURI, objType, filters);
		li.load(cb);
	}
}
/** Gets a resource of type `objType` using a Sid
	@param Sid - the Twilio Sid of the resource
	@param cb - (optional) if set, the callback will be called when completed
*/
exports.globalGet = function(objType) {
	return function(Sid, cb) {
		var obj = new objType(this, Sid);
		if(cb) obj.load(cb);
		return obj;
	};
}
/** Loads data from Twilio and updates this Object.
	@param data - (optional) if set, these data will replace this Object; otherwise,
		a RESTful call to the Twilio API will be made to update this Object.
	@param cb - (optional) if set, the callback will be called when completed
	@return - If data is set, the updated Object will be returned; otherwise,
		the stale object will be returned.
*/
exports.globalLoad = function(data, cb) {
	var obj = this,
		command = obj._getResourceURI("load");
	if(typeof data == "function")
	{
		cb = data;
		data = undefined;
	}
	if(data)
	{
		for(var i in data)
			this[i] = data[i];
		if(cb) cb(null, this);
	}
	else if(cb)
	{
		obj._client._restAPI('GET', command, function(err, res) {
			if(err) return cb(err);
			obj.load(res.body, cb);
		});
	}
	return this;
}
/** Saves mutable object properties to Twilio
	@param cb - (optional) called when save completes `cb(err, obj)`
*/
exports.globalSave = function(cb) {
	var obj = this,
		command = obj._getResourceURI("save"),
		mut = obj.constructor.mutableProps,
		data = {};
	for(var i in mut)
		if(obj[mut[i]])
			data[mut[i]] = obj[mut[i]];
	//Actually use POST here, even though PUT probably makes more sense for updating existing resources
	obj._client._restAPI('POST', command, data, function(err, res) {
		if(err) {
			if(cb) cb(err);
			return;
		}
		obj.load(res.body, cb);
	});
	return this;
}
/** Deletes the Object in Twilio
	@param cb - (optional) called when the delete completes `cb(err, success)`
*/
exports.globalDelete = function(cb) {
	var obj = this,
		command = obj._getResourceURI("delete");
	obj._client._restAPI('DELETE', command, function(err, res) {
		if(!err) obj._deleted = true;
		if(!cb) return;
		cb(err, err == null);
	});
}
/** Recursively convert all properties of the specified `obj` from
	'prop_like_this' to 'PropLikeThis'
	
	The "more better" JSON format isn't more better IMHO.
	http://www.twilio.com/docs/api/2010-04-01/changelog#more-better-json
	
	@param obj - object with property names separated by underscores
	@return obj with property names in CamelCase
*/
exports.underscoresToCamelCase = function underscoresToCamelCase(obj) {
	for(var i in obj)
	{
		if(typeof obj[i] == "object")
			underscoresToCamelCase(obj[i]);
		var newProp = i.split('_');
		for(var j in newProp)
			newProp[j] = newProp[j].charAt(0).toUpperCase() + newProp[j].substr(1);
		obj[newProp.join('')] = obj[i];
		if(!(obj instanceof Array) )
			delete obj[i];
	}
}