const {TurtleParser} = require('./lib/TurtleParser');
const {origText} = require('./lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const text = ` <z> <y> "a"^^<b> , "c"@de , "f"^^g:h ; <p2> 1 .`;
const [parseTree, quads] = parser.parse(text, baseIRI, {"g": "http://a.example/g#"});
console.log('--------------------');
const orig = origText(parseTree).join('');
if (orig === text)
  console.log('==')
else
  console.log("!=\n" + text + "\n--\n" + orig + "---");
console.log(JSON.stringify(parseTree, null, 2));
console.log(JSON.stringify(quads, null, 2));
