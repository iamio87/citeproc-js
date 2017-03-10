var complex = false
var SetLogic = (function(){

	var conditionObjList = [];
	var macros = {};

	function ObjectIntersection( A, B ) { //// A is parent, B is child. Operates on Conditions.match object.
		function intersection(A, B){ /// return elements held in common by both arrays
			if (check_list_equality(A, [0])){ /// zero represents an infinite set. B is a subset of A. return B.
				return B;
			} else if (check_list_equality(B, [0])){ //// B can also be an infinite set. If so, return A.
				return A;
			}
			return A.filter(function(n){ 
				return B.indexOf(n) !== -1;
			})
		}
		var ret = clone(A);
		Object.keys(B).map(function(key){
			if (A.hasOwnProperty(key)==false){
				ret[key]=[0]
			}
			ret[key] = intersection(ret[key], B[key])
		})
		return ret
	}

	function clone(object){
		return JSON.parse(JSON.stringify(object)) // Not only is this the fastest; it's recommended.dds
	}

	function complement(list){
		function _complement(A){
			var ret = ConditionsTemplate()
			Object.keys(A['match']).map(function(key){
				if (check_list_equality(A['match'][key], [0])) {
					ret['exclude'][key] = []
				} else {
					ret['exclude'][key] = A['match'][key]
				}
			})
			Object.keys(A['exclude']).map(function(key){
				if (A['exclude'][key].length == 0) {
					ret['match'][key] = [0]
				} else {
					ret['match'][key] = A['exclude'][key]
				}
			})
			return ret
		}
		return list.map(function(item){
			return _complement(item);
		})
	}

	function check_list_equality(A, B){ //// http://stackoverflow.com/questions/7837456/how-to-compare-arrays-in-javascript
		if (A.length != B.length){
			return false
		}
		  for (var i = 0, l=A.length; i < l; i++) {
		      // Check if we have nested arrays
		      if (A[i] instanceof Array && B[i] instanceof Array) {
		          // recurse into the nested arrays
		          if (!equals(A[i],B[i])){
		              return false;
					    }
		      } else if (A[i] != B[i]) { 
		          // Warning - two different object instances will never be equal: {x:20} != {x:20}
		          return false;   
		      }           
		  }
		return true;
	}

	function ObjectUnion( A, B ){ //// A is parent, B is child. Operates on Conditions.exclude object.
		function union(a, b){ /// return single instance of element held by either array.
			b.map(function(n){
				if (a.indexOf(n) == -1){
					a.push(n)
				}
			})
		}
		var ret = clone(A)
		Object.keys(B).map(function(key){
			if (A.hasOwnProperty(key) == false){
				ret[key] = [] /// empty array represents empty set. B is a superset of A. return B.
			}
			union(ret[key], B[key])
		})
		return ret
	}


	function JoinTests(list){
		function _joinTests( A, B ){
			return {"match":ObjectIntersection(A['match'], B['match']),"exclude":ObjectUnion(A["exclude"], B["exclude"])}
		}
		var ret = list.shift();
		while (list.length > 0){
			ret = _joinTests(ret, list.shift());
		}
		return [ret];
	}

	function SplitTest(A){
		ret =[]
		Object.keys(A['match']).map(function(prop){
			var obj = ConditionsTemplate()
			obj['match'][prop] = clone(A['match'][prop])
			ret.push(obj)
		})
		Object.keys(A['exclude']).map(function(prop){
			var obj = ConditionsTemplate()
			obj['exclude'][prop] = clone(A['exclude'][prop])
			ret.push(obj)
		})
		return ret
	}

	var getConditions = function(element){
		/// match all --> add conditions to conditions.matches object
		/// match none --> add conditions to conditions.excludes object and return multiple conditions objects.
		/// match any --> add conditions and return multiple conditions objects for branching logic paths.
		/// returns array of condition objects.
		if (element.attrs.hasOwnProperty('match')){
			matchTest = element.attrs['match'] // "all","any","none"
		} else {
			matchTest = "all"
		}
		var attrs
		var ret = []
		if (matchTest == "any"){
			Object.keys(element.attrs).map(function(key) {
				if (key != "match"){ //// exclude the "match" attribute alwayss
					var conditions = ConditionsTemplate()
					conditions['match'][key] = element.attrs[key].split(" ")
					ret.push(conditions)
				}
			})	
		} else if (matchTest == "all") {
			var conditions = ConditionsTemplate()
			Object.keys(element.attrs).map(function(key) {
				if (key !="match"){
					conditions['match'][key] = element.attrs[key].split(" ")
				}
			})
			ret.push(conditions)
		} else if (matchTest == "none") {
			var conditions = ConditionsTemplate()
			Object.keys(element.attrs).map(function(key) {
				if (key != "match"){
					conditions['exclude'][key] = element.attrs[key].split(" ")
				}
			})
			ret.push(conditions)
		} else if (matchTest == "nand") {//// notAll
			Object.keys(element.attrs).map(function(key) {
				if (key != "match"){ //// exclude the "match" attribute alwayss
					var conditions = ConditionsTemplate()
					conditions['exclude'][key] = element.attrs[key].split(" ")
					ret.push(conditions)
				}
			})	
		}
		return ret
	}

	var _compileConditions = function(output, inputList){
		//// inputList is supposed to be a matrix, or 2-level array.
		//// inputList is usually the output of getConditions()
		//// output is a single-level array.
		//// output usually is ParentConditions
			if (complex){
				console.log('hill', inputList)
				console.log('bill', output)
			}
		var list = clone(inputList); /// clone, so we don't disturb shared inputList.
		if (check_list_equality(output, [])){
			output = list.shift();
			return _compileConditions(output, list);
		} else if (list.length == 0) {
			return output;
		} else {
			newOutput = [];
			output.map(function(A){
				list[0].map(function(B){
					newOutput.push(JoinTests([A, B])[0]);
				})
			})

			list.shift()
			return _compileConditions(newOutput, list);
		}
	}

	function parseIf(element, parentConditions){
		if (element.name == "else"){
			element.children.map(function(child){
				parseTree(child, parentConditions); /// this can be asynchronous
			})
			return 0;
		}
		complex=false
		var matchTest
		var Conditions = element.children.filter(function(item){ 
			return item.name == "conditions"
		})
		if (Conditions.length == 1){ /// support for <condition> elements.
			if (Conditions[0].attrs.hasOwnProperty('match')){
				matchTest = Conditions[0].attrs['match'] // "all","any","none","notAll"
			} else {
				matchTest = "all"
			}
			var childConditions = Conditions[0].children.map(function(A){
				return getConditions(A)
			})
			complex = true;
			console.log(childConditions);
		} else { //// No <conditions> element to worry about.
			matchTest = "all"
			var childConditions = [getConditions(element)]
		}
		var descendantConditions = [];
		var siblingConditions = [];
		//// These test exist solely to support <conditions> elements. Regular <if> elements are equivalent to <conditions match="all">, because the "match" case has already been applied in getConditions(element). It's only the two-layer logic of <conditions> that requires advanced logic.
		if (complex){console.log('matchTest', matchTest)}
		if (matchTest == "any") {
			if (complex){console.log('ball')}
			console.log('hi',JoinTests(_compileConditions([], childConditions)), _compileConditions([], childConditions))
			siblingConditions = complement(JoinTests(_compileConditions([], childConditions)))
			if (complex){console.log("any",siblingConditions, descendantConditions)}
			childConditions.map(function(row){
				row.map(function(A){
					descendantConditions.push(A)
				})
			})
		} else if (matchTest == "none") {
			descendantConditions = complement(_compileConditions([], childConditions))
			childConditions.map(function(row){
				row.map(function(A){
					SplitTest(A).map(function(a){
						siblingConditions.push(a)
					})
				})
			})
		} else if (matchTest == "nand") {///not all
			siblingConditions = JoinTests(_compileConditions([], childConditions))
			childConditions.map(function(row){
				complement(row).map(function(A){
					descendantConditions.push(A)
				})
			})
		} else if (matchTest == "all") {
			descendantConditions = _compileConditions([], childConditions);
			childConditions.map(function(row){
				complement(row).map(function(A){
					SplitTest(A).map(function(a){
						siblingConditions.push(a)
					})
				})
			})
		}
		var descendantList = _compileConditions(parentConditions, [descendantConditions]) //// always a match all test for combining with parent conditions.
		var siblingList = _compileConditions(parentConditions, [siblingConditions]) /// subsequent sibilings inherit restrictions that are the inverse of the conditions applied to children of this element.
		if (complex){
			console.log('outcome',siblingList)
		}
		element.children.map(function(child){
			parseTree(child, descendantList); /// this can be asynchronous
		})
		return siblingList
	}

	function getSubFields(element){
		return element.children[0].chidren.filter(function(item){
			return item
		})
	}

	function parseTree(element, conditions){
		if (element.name == "text") {
			if (element.attrs.hasOwnProperty('macro')){
				parseTree(macros[element.attrs.macro], conditions);
			} else if (element.attrs.hasOwnProperty('variable')){
				conditions.map(function(conditionObj){
					conditionObj['field']=element.attrs.variable;
					conditionObj['datatype']="text";
					conditionObjList.push(conditionObj)
				})
			} else {
			
			}
		} else if (element.name == "names"){
			conditions.map(function(conditionObj){
				conditionObj['field']=element.attrs.variable;
				conditionObj['datatype']="names"
				conditionObjList.push(conditionObj)
			})
		} else if (element.name == "number"){
			conditions.map(function(conditionObj){
				conditionObj['field']=element.attrs.variable;
				conditionObj['datatype']="number"
				conditionObjList.push(conditionObj)
			})
		} else if (element.name == "date"){
			conditions.map(function(conditionObj){
				conditionObj['field']=element.attrs.variable;
				conditionObj['datatype']="date"
				conditionObjList.push(conditionObj)
			})
		} else if (element.name == "containers"){
			subfields = getSubFields(element);
			conditions.map(function(conditionObj){
				conditionObj['field'] = element.attrs.variable;
				conditionObj['datatype'] = "container";
				conditionObj['subfields'] = [];
				subfields.map(function(subfield){
					conditionObj['subfields'] = {'name':subfield.name,'label':subfield.name,'datatype':'string'}
				})
			})
		} else if (element.name == "macro") {
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name == "choose"){
			element.children.map(function(item){
				conditions = parseIf(item, conditions)
			})
		} else if (element.name == "layout"){
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name == "substitute"){
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name == "group"){
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name=="else"){
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name=="style"){ /// top-level element of CSL style. 
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name=="bibliography"){ /// top-level element of CSL style. 
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else if (element.name=="citation"){ /// top-level element of CSL style. 
			element.children.map(function(item){
				parseTree(item, conditions)
			})
		} else {
			return 1
		}
	}

	function ConditionsTemplateStart() {
		return {
			"match":{
				"type":[0],
				"subtype":[0],
				"variable":[0],
			},
			"exclude":{
				"type":[],
				"subtype":[],
				"variable":[],
			}
		}
	}

	function ConditionsTemplate() {
		return {
			"match":{	},
			"exclude":{	}
		}
	}

	function ConditionsTestTemplate() {
		return {
			"match":{
				"arg1":[0],
				"arg2":[0],
				"arg3":[0],
			},
			"exclude":{
				"arg1":[],
				"arg2":[],
				"arg3":[],
			}
		}
	}

	function compileConditions(CSLtree){
		var citationLayout, bibliographyLayout

		CSLtree.filter(function(element){
			if (element.name == "macro") {
				macros[element.attrs.name] = element;
			} else if (element.name == "bibliography") {
				bibliography = element;
			} else if (element.name == "citation") {
				citation = element;
			}
		})

		try {
			parseTree(bibliography, [ConditionsTemplateStart()]);
		} catch(e) {}
		try {
			parseTree(citation, [ConditionsTemplateStart()]);
		} catch(e){}
//		parseTree(CSLtree); /// you can parse the whole tree just fine. However, I want to make sure the bibliographyLayout is parsed first, because it's more comprehensive --> and I want FieldOrder to reflect bibliography formatting over citation formatting.
		return conditionObjList;
	}

	function testEngine(CSLtree){
		ConditionsTemplate = ConditionsTestTemplate; //// special Template for testing
		compileConditions(CSLtree)
		ConditionsTemplate = function() {
			return {
				"match":{
					"type":[0],
					"subtype":[0],
					"variable":[0],
				},
				"exclude":{
					"type":[],
					"subtype":[],
					"variable":[],
				}
			}
		}
		return conditionObjList;
	}

	return {//// Public API
		compileConditions:compileConditions,
		testEngine:testEngine,
		check_list_equality:check_list_equality,
		conditionObjList:conditionObjList,
		jointests:JoinTests
	}
})()


var rules = citeproc.registry.state.cslXml.dataObj.children;
//setTimeout(function(){z=SetLogic.compileConditions(rules)},300);
var FormBuilder = (function(){

	function clone(object){
		return JSON.parse(JSON.stringify(object)) // Not only is this the fastest; it's recommended.dds
	}
	var reservedVariables = ['first-reference-note-number','locator','year-suffix',"locator-date","locator-extra",	'citation-label',	'citation-number']
	var CSLvariables = [
		'abstract',
		'annote',
		'archive',
		'archive_location',
		'archive-place',
		'authority',
		'call-number',
		'collection-title',
		'container-title',
		'container-title-short',
		'dimensions',
		'DOI',
		'event',
		'event-place',
		'genre',
		'ISBN',
		'ISSN',
		'jurisdiction',
		'keyword',
		'medium',
		'note',
		'original-publisher',
		'original-publisher-place',
		'original-title',
		'page',
		'page-first',
		'PMCID',
		'PMID',
		'publisher',
		'publisher-place',
		'references',
		'reviewed-title',
		'scale',
		'section',
		'source',
		'status',
		'title',
		'title-short',
		'hereinafter',
		'URL',
		'version'
	]
	CSLvariables = []
	CSLtypes=[]
	CSLstypes = []

	var VariableFields = {"types":{},"stypes":{}};
	var FieldOrder = [];
	var FieldType = {};
	
	function addField(field, variable, type, datatype){
		if (reservedVariables.indexOf(field) ==-1){
			if (typeof(VariableFields[type][variable])=="undefined"){
				VariableFields[type][variable]=[]
			}
			if (VariableFields[type][variable].indexOf(field) == -1){
				VariableFields[type][variable].push(field)
			}
			if (FieldOrder.indexOf(field) == -1){
				FieldOrder.push(field)
			}
			if (typeof(FieldType[field]) == "undefined"){
				FieldType[field] = datatype;
			}
		}
	}

	function EvaluateConditionObjects(list, counter){
		if (typeof(counter) == "undefined"){ //// House-work on first call.
			list.map(function(obj){////make sure non-standard CSLtypes are added.
				if (!SetLogic.check_list_equality(obj['match']['type'], [0])){/// NOT == [0]
					obj['match']['type'].map(function(type){
						if (CSLtypes.indexOf(type)==-1){ //// ...and not already listed...
							CSLtypes.push(type) //// ...then add to list
						}
					})
				}
				obj['exclude']['type'].map(function(type){ ////add implied fields. no need to check for [0]. 
					if (CSLtypes.indexOf(type)==-1){
						CSLtypes.push(type)
					}
				})
				if (reservedVariables.indexOf(obj['field']) > -1){
					console.log(obj['field'])
					list.pop(obj)
				} else {
					CSLvariables.push(obj['field'])
				}
			})
			var counter = 0;
		}
		var prevLength = list.length;
		var newList = [];

		list.map(function(obj){
			var field= obj['field'];
			var datatype = obj['datatype'];
			var types = obj['match']['type'];
			var subtypes = obj['match']['subtype'];
			if (SetLogic.check_list_equality(types, [0])){ //// [0] includes all types.
				types = clone(CSLtypes);
			}
			if (CSLstypes.length > 0) { //// if CSLstypes are defined
				if (SetLogic.check_list_equality(stypes, [0])){ //// if no match restrictions...
					subtypes = clone(CSLstypes); /// ...assign subtypes to full list
				}
				subtypes = subtypes.filter(function(stype){ //// remove any stypes that are excluded
					return obj['exclude']['subtype'].indexOf(stype) == -1 /// if not excluded, return
				})
			} else {//// if CSLstypes are not defined
				subtypes = [0] //// apply no restrictions.
			}
			var types= types.filter(function(type){
				return obj['exclude']['type'].indexOf(type) == -1 /// if not excluded, return
			})

/*			if (!SetLogic.check_list_equality(obj["match"]["variable"], [0])){
				if (counter==0){ /// objects w/ match.variable should be evaluated last.
					newList.push(list.pop(obj)) 
				} else {
					/// advanced algorithm. Could make dependent variables a thing if I wanted.
					variables = clone(obj['match']['variable'])
					variables.map(function(variable){
						if (!SetLogic.check_list_equality(subtypes, [0])){
							subtypes.map(function(stype){
								if (VariableFields["stypes"][stype].indexOf(variable) != -1){
									VariableFields["stypes"][stype].push(field);
								}
							})
						} else {
							types.map(function(type){
								if (typeof(VariableFields['types'][type]) == "undefined"){
									VariableFields['types'][type] = []
								}
								if (VariableFields["types"][type].indexOf(variable) != -1){
									VariableFields["types"][type].push(field);
								}
							})
						}
					})
				}
			} else {*/



			if (SetLogic.check_list_equality(subtypes, [0])){ /// no restriction on stype
				types.map(function(type){
					if (CSLtypes.indexOf(type) > -1) {/// do not add reserved or restricted types
						addField(field, type, "types", datatype) 
					}
				})
			} else { //// restriction on stype
				subtypes.map(function(stype){
					if (types.indexOf(CSLstypes[stype]) != -1) {
						addField(field, stype, "stypes", datatype)
					}
				})
			}
			///// end //////	
		})
	}

	function retrieve(){
		EvaluateConditionObjects(SetLogic.compileConditions(rules));
		return VariableFields;
	}

	function build(){
/*		table = "<table>"
		Object.key(VariableFields['types']).reduce(function(key){
			return "<tr><td>"+key+"</td><td>"+
		}*/
	}

	
	return { //// Public API
		retrieve:retrieve,
		z:VariableFields,
		stypes:CSLstypes,
		types:CSLtypes
	}
})()




sample1 = {'match':{'arg1':[0]},'exclude':{'arg1':['A','B','C','D'],'arg2':['a','b','c','d']}}
sample2 = {'match':{'arg1':['A','B','C','D']},'exclude':{'arg3':['1','2','3','4'],'arg2':['c','d','e','f']}}

var van = SetLogic.jointests([sample1, sample2])
var varn
setTimeout(function(){
varn = SetLogic.compileConditions(rules)
},200)

/* This section is a mind-fuck. If you thought programming formal logic would be easy, then you've never done it. It's counter-intuitive.
It's not the simple logic that's the problem, the problem is really about nesting complexity. But before we get to the fun, riduculous problems, let's have a refresher in set logic.

A set is a collection of members. Let's think of them as arrays "[]". A set is empty if it has no members. The members of a set can also be infinite, even if it does have limitations. However, the easiests sets to work with are sets with a finite number of members. I refer to sets with finite membership (including empty sets) as "positive sets", because they can be expressed as themselves. Infinite sets (such as complement sets defined below) can only be expressed as the "negative" of a finite set.

Relationship between sets can be made, and recharacterized as sets themselves. 

If you want to join two or more sets to together, it's called the "union" of sets. A union is a superset of all members of its subsets. --> Union = expansion

If you want only the common members of two or more sets, it's call the "intersection" of sets. An intersection is a subset of each of the higher sets. --> Intersection = reduction (contraction)

If you want only the members that are NOT part of a set, it's called the "complement" of the set. In formal logic, it is stated as "NOT a member of Set" and is represent as " ~Set " in notation. The complement of a set is infinite set that it is impossible to represent in positive terms. A complement can only be represented as the negative of another set. The "complement" operator is often ambiguous when expressed in natural language, and it is impossible to express directly in a programming context.

A truth set is a collection of members that satisfy a truth statement or equation. Membership in the set is determined by whether that member can satisfy the equation. For example, the set Food is defined by the equation is_editable(x)? If a material is edible, then it is a member of the set Food.

Mapping out set operations to natural English is not straightforward, it has some interesting wrinkles. There are 4 basic logic operations:
"All" --> All conditions must return true.
"Any" --> At least one condition must return true.
"None" --> All conditions must return false. (Same as "Not any")
"Not All" --> At least one condition must return false. 

Even though there are 4 basic logic operations, there are only 3 types of set operations ('union', 'intersection', 'complement'). How can we reconcile set logic with our intuitive logic?

Let's take a little rabit trail with logic operators. See below:
"AND" --> A AND B are both true. Corresponds to "Intersection" in truth set logic.
"OR" --> A is true, OR B is true. Corresponds to "Union" in truth set logic.
"NOT" --> A is not true. Corresponds to "complement" in truth set logic.
"XOR" (eXclusive OR) --> A is true, OR B is true, but not both are true. No correspondence.
The "XOR" operator has no correlary in natural language or in set logic. Also note that "Not" does not operate on more than one statement. Wierd, huh? However, we are going to use these logic operators to help us translate from natural language to set logic.


Using logic operators as an intermediate language, we translate natural language logic in to set logic operations on truth sets.
"ALL" --> True if A AND B are true --> Intersection(A, B)
"ANY" --> True A OR B are true--> Union(A, B)
"NONE" --> True if A AND B are false --> Intersection(~A, ~B)
"NOT ALL" --> True if A OR B are false --> Union(~A, ~B)

I am going to apply these rules to compiling CSL logic. We start with an object {} called "conditions". Whenever we encounter a truth set expressed as a positive, we record it in conditions['match']. Whenever we encounter a truth set expressed as a complement (or negative) of another set, then we record those criteria in conditions["exclude"]. If you haven't realized it already, complement sets are not logically symmetrical to positive sets.
When the CSL processor evaluates the truth of a statement, it will return true if the object matches ANY member of the conditions['match']. It will return false if the object matches ANY member of the conditions['exclude'] set. Thus, to be completely true, the object must match NONE of the conditions['exclude']. In order to work with positive sets, we can use De Morgan's law to transform our formulas so that they only deal with finite sets.

"All" --> Intersection(A['match'], B['match'])
"Any" --> Union(A['match'], B['match'])
"None/Not Any") --> Intersection(~A, ~B) --> ~Union(A, B) --> Union(A['exclude'], B['exclude'])
"Not All" --> Union(~A, ~B) --> ~Intersection(A, B) --> Intersection(A['exclude'], B['exclude'])

De Morgan's Law
~(P | Q) <-> (~P & ~Q)
~(P & Q) <-> ~P | ~Q

Let's get back to the application of these logic operations on our "conditions" object. When performing an Intersection() operation, you can return a single object. However, a Union operation might be too complicated to be represented by a single "conditions" object, so it will return multiple objects that must be evaluated independently.

"All" returns a single object. The negation of "All" is "Not All", which also returns a single object.
"Any" returns multiple objects. The negation of "Any" is "None/Not Any", which also returns multiple objects.

The conditions['match'] object starts as an infinite set. Any additional criteria decreases the possible set of condition['match']. The match group cannot grow.
The conditions['exclude'] object starts as an empty set. Any additional criteria expands the possible set of conditions['exclude']. The exclude group cannot shrink.

One problem that I run into a lot is trying to represent CSL logic in truth tables. The 1st conditional can be represented as "If (A)". The subsequent level is "If ((A) & B)". The next level would be "If (((A) & B) & C)." And so on. Each level is joined by a logical "AND" operation, so it's always an intersection operation. Also consider that each conditional can only be evaluated after the previous conditional. So the constraints on the truth set can only be increased; the constraints are never decreased. That is why conditions['match'] is always intersected, but conditions['exclude'] is actually unioned. 

The second problem I run into is dealing with OR operations ("ANY" and "NONE"). In truth tables, they are represented as (A OR B OR C). Unfortunately, these are complex to represent as an array. I am trying to compress branching logic into a flat conditions object with "match" and "exclude" arrays. The relative position of the "OR" condition is relevant to evaluating a truth statement. However, information about relative position is purposefully discarded in my compressed condition objects. However, I can get around this limitation by creating two condition objects - with each representing a different valid truth condition.

The JurisM-CSL extension supports complex conditional logic using a <conditions> and <condition> elements. The following details how it flows:
<condition>
    "all" --> [intersection(match1, match2)]
	"any" --> [match1, match2]
    "none" --> [union(exclude1, exclude2)]
	"notAll" --> [exclude1, exclude2]

<conditions>// ~ means "compliment". "AC" means union of "A" and "C". Array elements are joined by "OR".
	"all"	--> "set1" AND 	"set2"	= "set3"
				[A, B]		[C, D]	= [AC, AD, BC, BD]

	"any"	--> "set1" OR 	"set2"	= "set3"
				[A, B]		[C, D] 	= [A, B, C, D]

	"none"	--> "set1" AND 	"set2"	= "set3"
				[A, B]		[C, D] 	= [~AC, ~AD, ~BC, ~BD]

	"notAll"--> "set1" AND 	"set2"	= "set3"
				[A, B]		[C, D]	= [~A, ~B, ~C, ~D]
 */

/*
all --> none
none --> all
any --> all
any --> none
all --> any
none --> any

<text macro="macroname"/>
<text variable=""> //form="short/verb" //value="variableName"
<text term=""> // like value, but is limited to Appendix II, and can be pluralized and genderized
<text value=""> // like term, but no support for localization?
<choose>
<if>
<else-if>
<else>
<conditions>
<condition>

conditions: position; match=all,any,none; variable; type; subtype; is-numeric; is-plural; disambiguate, is-uncertain-date; 

<number variable>
<text variable>
<names variable>
<date variable> //date-parts

excluded_variables = ["locator","locator-date","locator-extra","first-reference-note-number"]
*/

// we are going to ignore <group> elements for our logical testing. Yes, it's an implied conditional,but if <group> is the root element, then we have to resolve the ambiguity in favor of display. We must rely on explicit conditions to narrow field choice.

/*var conditions = {
	"matchAll":"",
	"matchAny":"",
	"matchNone":"",
	"type":[],
	"subtype":[],
	"variable":[],
	"position":[],
	"is-numeric":[],
	"is-plural":[],
	"disambiguate":[],
	"is-uncertain-date":[]
}
*/
