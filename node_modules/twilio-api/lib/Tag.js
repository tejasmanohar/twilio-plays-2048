/** Constructor for a Tag Object, which represents an XML tag.
	@param name - the name of the tag.
*/
var Tag = module.exports = function Tag(name) {
	this.name = name;
	this.attributes = {};
};
/** Set an attribute for this tag.
	@param name
	@param value
*/
Tag.prototype.setAttribute = function(name, value) {
	if(name != null && value != null)
		this.attributes[name] = value;
	return this;
}
/** Appends a Tag, a string, or an array of these to the content
	of the tag.
	@param content - a Tag object, a string, or an array containing a mixture
		of the two
*/
Tag.prototype.append = function(content) {
	if(this.content == undefined)
		this.content = [];
	this.content.push(content);
	return this;
}
/** Generates an XML string with this Tag as the root element.
	@param excludeXMLDecl - if false or unspecified, the XML declaration will
		be prepended to the XML string; if true, the XML declation will not be
		prepended to the XML string, allowing you to render parts of an XML
		document.
	@return an XML string
*/
Tag.prototype.render = function(excludeXMLDecl) {
	var str = '';
	if(excludeXMLDecl !== true)
		str = '<?xml version="1.0" encoding="UTF-8"?>';
	str += '<' + this.name;
	for(var i in this.attributes)
		str += " " + i + '="' + escape(this.attributes[i]) + '"';
	if(typeof this.content == "string")
		str += ">" + escape(this.content) + "</" + this.name + ">";
	else if(this.content instanceof Array)
	{
		str += ">";
		for(var i in this.content)
		{
			if(typeof this.content[i] == "string")
				str += escape(this.content[i]);
			else if(this.content[i] instanceof Tag)
				str += this.content[i].render(true); //Recursive rendering
		}
		str += "</" + this.name + ">";
	}
	else
		str += "/>";
	return str;
}
/** toString function is an alias for render.
	@see #render(...)
*/
Tag.prototype.toString = Tag.prototype.render;
/** Escapes certain HTML entities. Similar to PHP's htmlspecialchars.
	@param html - the string to escape (i.e. "<Smith> & John")
	@return the escaped string (i.e. "&lt;Smith&gt; &amp; John")
*/
function escape(html) {
  return String(html)
    .replace(/&(?!\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};