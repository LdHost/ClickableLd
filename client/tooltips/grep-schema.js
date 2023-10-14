#!/bin/env node
const WEBPAGE = process.argv[2];
const OUTFILE = process.argv[3];

const PREFIXES = `
  PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
`;

const QueryEngine = require('@comunica/query-sparql-rdfjs').QueryEngine;
const myEngine = new QueryEngine();
const {Store, DataFactory, Parser} = require('n3');

process.stdout.write(`translating <${WEBPAGE}> to ${OUTFILE}\n`);
const Fs = require('fs');

main()

async function main () {
  let t = new Date(), t1;
  process.stdout.write(`contacting ${WEBPAGE}`);
  const resp = await fetch(WEBPAGE, {redirect: 'follow', headers: {Accept: 'text/turtle'}});
  t1 = new Date();
  process.stdout.write(' ' + (t1 - t) + 'ms\n');
  t = t1;
  process.stdout.write(`fetching ${WEBPAGE}`);
  const turtle = await resp.text();
  // const turtle = require('fs').readFileSync('/home/eric/Downloads/ldp.ttl', 'utf-8');
  t1 = new Date();
  process.stdout.write(' ' + (t1 - t) + 'ms\n');
  t = t1;
  const store = new Store();
  const parser = new Parser({baseIRI: WEBPAGE});
  store.addQuads(parser.parse(turtle));

  process.stdout.write(`writing ${store.size} triples to ${OUTFILE}`);
  const lines = []
        .concat(await queryType(store, "rdfs:Class", "class"))
        .concat(await queryType(store, "rdf:Property", "property"));

  Fs.writeFileSync(OUTFILE, "{\n" + lines.join(",\n") + "\n}");
  t1 = new Date();
  process.stdout.write(' ' + (t1 - t) + 'ms\n');
  JSON.parse(Fs.readFileSync(OUTFILE, "utf-8"));
}

async function queryType(store, rdfTypeStr, jsonTypeStr) {
  const typedStream = await myEngine.queryBindings(`
  ${PREFIXES}
  SELECT ?c ?label ?definition ?comment WHERE {
    ?c a ${rdfTypeStr} ;
    OPTIONAL {
      ?c rdfs:label ?label
      FILTER (langMatches(lang(?label), "en") || lang(?label)='')
    }
    OPTIONAL {
      ?c skos:definition ?definition
      FILTER (langMatches(lang(?definition), "en") || lang(?definition)='')
    }
    OPTIONAL {
      ?c rdfs:comment ?comment
      FILTER (langMatches(lang(?comment), "en") || lang(?comment)='')
    }
  }`, {
    sources: [store],
  });
  const typed = (await typedStream.toArray()).map(b => Object.fromEntries(b.entries));
  return typed.map(t => {
    const id = t.c.value;
    const obj = {type: jsonTypeStr};
    if (t.label)
      obj.label = t.label.value;
    if (t.definition)
      obj.definition = t.definition.value;
    else if (t.comment)
      obj.definition = t.comment.value;
    return '"' + id + '":' + JSON.stringify(obj);
  });
}
