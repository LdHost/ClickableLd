const {TurtleParser} = require('./lib/TurtleParser');
const {origText} = require('./lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const text = `PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/pre:s<p>_:o,[<p1><o1>],(),(1),1,"1","1"^^<http://www.w3.org/2001/XMLSchema#integer>,"1"@en,true.`;
const [parseTree, quads] = parser.parse(text, baseIRI, {"g": "http://a.example/g#"});
console.log('--------------------');
const orig = origText(parseTree).join('');
if (orig === text)
  console.log('==')
else
  console.log("!=\n" + text + "\n--\n" + orig + "---");
console.log(JSON.stringify(parseTree, null, 2));
console.log(JSON.stringify(quads, null, 2));
