const {TurtleParser} = require('./lib/TurtleParser');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const [quads, locations] = parser.parse(`

PREFIX pre: <http://a.example/ns>

<url1> a pre:Class1, pre:Class2;
  pre:p1 "cd", _:xy; pre:p2 <//b.example/u3>.

(111 (222 333) 444 [pre:p3 [pre:p4 'p4']; pre:p5 555])
  pre:p6 666.
`);
console.log(quads, locations);
