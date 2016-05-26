var run_template = function(json, template) {
	var result = {};
	var is_array = template instanceof Array;
	var array_result = [];

	Object.keys(template).forEach(function(key) {

		// In cases where we are doing a search
		// we wish to retrieve the values that
		// match the search path, and then
		// run the value checking on that

		if (key.indexOf('$') >= 0) {
			// Grab the values for the keys
			// If the key does not match, then the 
			// jpath will return a null value
			// for that key
			var keys = jpath({json: json,path: key });

			// We wish to retrieve the parent objects
			// for each of the keys.

			// If we are selecting on a single key:
			// Turn $[*].SOME_KEY into $[*].

			// If we are selecting on multiple attributes:
			// Turn $..[ATTR1,ATTR2] into $..

			var objects_key = key.replace(/(([^\.]+)$|\[.+\]$)/,'');

			// Go up 1 level in the heirarchy
			// Single key: $[*]
			// Multiple attributes: $.
			objects_key = objects_key.split('.').slice(0,-1).join('.');
			var objects = jpath({json: json, path: objects_key});

			objects.forEach(function(obj,idx) {
				var object_key = keys[idx];
				// If we get a key match for this returned object
				// We should run the sub-template on this
				if ( ! object_key ) {
					return;
				}

				// As an additional bonus, if the data key looks like
				// it is a list of things (seperated by , ; or space)
				// we should split that list and copy the values into each 
				// entry.

				object_key.split(/[,;\s]+/).forEach(function(split_key) {
					if (! result[split_key] ) {
						result[split_key] = [];
					}
					result[split_key].push( run_template( obj, template[key] ) );
				});
			});
			return;
		}

		// For keys where we are doing a direct indexing, grab the value out

		// { "some-key" : "@value" } should work like {"some-key" : json.value }
		if (typeof template[key] === 'string' && template[key].indexOf('@') == 0) {
			result[key] = jpath({json: json, path: template[key].replace('@','') })[0];
			return;
		}

		// // { "some-key" : [ primitive-values ]} should map to { "some-key" : [ primitive-values ] }

		// if (template[key] instanceof Array) {
		// 	result[key] = [].concat(template[key]);

		// { "some-key" : { // sub-template }} should map to { "some-key" : run_template(json,sub-template) }

		if (template[key] instanceof Object) {
			result[key] = run_template(json,template[key]);

		// { "some-key" : some-other-value } should map to { "some-key" : some-other-value }
		} else {
			result[key] = template[key];
		}

		if (is_array) {
			array_result.push(result[key]);
		}
	});
	return is_array ? array_result : result;
};
