#!/bin/env node
const WEBPAGE = process.argv[2];
const OUTFILE = process.argv[3];

process.stdout.write(`translating <${WEBPAGE}> to ${OUTFILE}\n`);
const Fs = require('fs');

// main()

async function main () {
  let t = new Date(), t1;
  process.stdout.write(`contacting ${WEBPAGE}`);
  const resp = await fetch(WEBPAGE, {redirect: 'follow', });
  t1 = new Date();
  process.stdout.write(' ' + (t1 - t) + 'ms\n');
  t = t1;
  process.stdout.write(`fetching ${WEBPAGE}`);
  const json = await resp.json();
  // const json = JSON.parse(require('fs').readFileSync('/home/eric/Downloads/hp.json', 'utf-8'));
  t1 = new Date();
  process.stdout.write(' ' + (t1 - t) + 'ms\n');
  t = t1;
  const nodes = json.graphs[0].nodes;
  process.stdout.write(`writing ${nodes.length} records to ${OUTFILE}`);
  const lines = nodes.map(n => {
    const obj = {};
    if (n.lbl)
      obj.label = n.lbl;
    if (n.meta && n.meta.definition)
      obj.definition = n.meta.definition.val;
    if (n.type) {
      if (n.type === 'CLASS')
        obj.type = 'class';
      else if (n.type === 'PROPERTY')
        obj.type = 'property'
    }
    return '"' + n.id + '":' + JSON.stringify(obj);
  });
  Fs.writeFileSync(OUTFILE, "{\n" + lines.join(",\n") + "\n}");
  t1 = new Date();
  process.stdout.write(' ' + (t1 - t) + 'ms\n');
  JSON.parse(Fs.readFileSync(OUTFILE, "utf-8"));
}
