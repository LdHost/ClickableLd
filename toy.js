const {TurtleParser} = require('./lib/TurtleParser');
const {origText} = require('./lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
const [locations, quads] = parser.parse(`
PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/

/*a*/<url1>/*b*/a/*c*/pre:Class1/*d*/,/*e*/pre:Class2/*f*/; #here
  pre:p1 "cd" , _:xy ;
  pre:p2 <//b.example/u3> .

/*a*/(/*b*/111/*c*/(/*d*/222/*e*/333/*f*/)/*g*/444/*h*/ [ pre:p3 [ pre:p4 'p4' ] ; pre:p5 555 ] )/*i*/ 
  pre:p6 () .
 [ <a> 1 ] <b> 2 . # [ <c> 3 , "chat" ^^ pre:dt, [ <d> 4 ] , "chat" @en ] . 
`);
console.log('--------------------');
console.log(JSON.stringify(quads, null, 2));
console.log(origText(locations).join(''));
console.log(JSON.stringify(locations, null, 2));
