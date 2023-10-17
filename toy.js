const {TurtleParser} = require('./lib/TurtleParser');
const {origText} = require('./lib/TurtleJisonContext');
const {DataFactory} = require('rdf-data-factory');

const baseIRI = 'http://localhost/some/path.ext'
const factory = new DataFactory();
const parser = new TurtleParser({baseIRI, factory})

console.log('--------------------');
// const text = `PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/pre:s<p>_:o,[<p1><o1>],(),(1),1,"1","1"^^<http://www.w3.org/2001/XMLSchema#integer>,"1"@en,true.`;
// const text = `<x> <p> ( [ <p3> [ <p4> 'p4' ] ] ) .`;
// const text = `<s><p>"1"/*1*/\n/*2*/^^/*3*/\n/*4*/<dt>.`;
// const text = `/*0*/(/*1*/(/*2*/1/*3*/)/*4*/2/*5*/)/*6*/<p>(()).`;
// const text = `PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/pre:s<#p><#o>.`
// const text = `[<#p1>[<#p2><#o2>]]<#p3>[<#p4>[<#p5><#o5>]].`;
// const text = `(())<p>(()).`
// const text = `<s><p>(<c>(<d>)).`
const text = `
BASE/*a*/<http://localhost/some/path.ext>/*b*/
PREFIX/*a*/pre:/*b*/<http://a.example/ns#>/*c*/
@prefix/*a*/:/*b*/<http://a.example/ns#>/*c*/.pre:s<#p><#o>.`;
const parseTree = parser.parse(text, baseIRI, {"g": "http://a.example/g#"});
console.log('--------------------');
// parser.decorateRdfjs(parseTree);
const orig = origText(parseTree).join('');
if (orig === text)
  console.log('==')
else
  console.log("!=\n" + text + "\n--\n" + orig + "---");
console.log(JSON.stringify(parseTree, null, 2));
console.log(JSON.stringify(parser.getQuads(), null, 2));
