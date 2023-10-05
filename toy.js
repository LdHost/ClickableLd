const {TurtleParser} = require('./lib/TurtleParser');
const {origText} = require('./lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const text = `
PrEfIx : <http://sparql.example/#> 
pReFiX pre: <http://sparql.example/pre#> 
@prefix : <http://turtle.example/#> .
@prefix pre: <http://turtle.example/pre#> .
BaSe <http://sparql.example/base/>
@base <//turtle.example/base/> .

<s> <p> "a", 'b', """c
c"""@en-us, '''d
d''', -0, 1, 2.0, 3E+0, 4.5E-6, .7E1 .
`;
const [parseTree, quads] = parser.parse(text, baseIRI, {"g": "http://a.example/g#"});
console.log('--------------------');
const orig = origText(parseTree).join('');
if (orig === text)
  console.log('==')
else
  console.log("!=\n" + text + "\n--\n" + orig + "---");
console.log(JSON.stringify(parseTree, null, 2));
console.log(JSON.stringify(quads, null, 2));
