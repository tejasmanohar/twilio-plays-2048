var util = require('util');
function ListIterator(parent, command, _class, filters) {
	this._parent = parent;
	this._client = parent._client;
	this.command = command;
	this._class = _class;
	this.filters = filters;
	this.Page = 0;
	this.NumPages = 1;
	this.PageSize = 20;
}
module.exports = ListIterator;
ListIterator.prototype.nextPage = function(cb) {
	if(this.Page < this.NumPages - 1)
	{
		this.Page++;
		this.load(cb);
	}
  else
    cb(new Error('No next page.'));
}
ListIterator.prototype.prevPage = function(cb) {
	if(this.Page > 0)
	{
		this.Page--;
		this.load(cb);
	}
  else
    cb(new Error('No previous page.'));
}
ListIterator.prototype.load = function(cb) {
	var li = this;
	var data = {
		'Page': li.Page,
		'PageSize': li.PageSize
	};
	for(var i in li.filters)
		data[i] = li.filters[i];
	li._client._restAPI('GET', li.command, data, function(err, res) {
		if(err) return cb(err);
		for(var i in res.body)
			li[i] = res.body[i];
		//There's some pretty abstract shiz goin' on up in here!  WTF does it mean?
		var list = li.command.split("/");
		list = list[list.length - 1];
		li.Results = li[list];
		list = li[list];
		for(var i in list)
		{
			//It means take the Objects and cast them into their class!
			var tmp = list[i];
			li._class.call(tmp, li._parent, tmp.Sid);
			tmp.__proto__ = li._class.prototype;
			tmp.constructor = li._class;
			list[i] = tmp;
		}
		cb(null, li);
	});
};
