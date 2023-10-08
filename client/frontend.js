
const Elts = {
  page: document.querySelector('#page')
};

const QS = document.querySelector.bind(document);
const QSA = document.querySelectorAll.bind(document);

window.addEventListener("load", onLoad);

function log (className, msg) {
  const li = document.createElement('li');
  li.className = className;
  li.innerText = msg;
  QS('#messages').prepend(li);
}

async function onLoad (evt) {
  Elts.page.oninput = inputDoc;
  const params = new URLSearchParams(location.search);
  const browse = params.get('browse');
  if (browse) {
    Elts.page.value = browse;
    inputDoc.call(Elts.page, evt);
  }
}

async function inputDoc (evt) {
  if (this.value)
    renderDoc(this.value);
}

async function renderDoc (url) {
  const resp = await fetch(url);
  const body = await resp.text();
  if (!resp.ok)
    throw Error(`fetch(${url}) => ${resp.code}:\n${body}`);
  new RenderClickableLd(document, document.location.href, body, 'text/turtle', {
    sparqlPrefix: ".",
    skipped: ".",
    namespace: ".",
    "pname": "pname",
    "BLANK_NODE_LABEL": "bnode",
    "ANON": "bnode",
    "blankNodePropertyList": "bnode",
    "collection": "bnode",
    "simpleLiteral": "literal",
    "datatypedLiteral": "literal",
    "langTagLiteral": "literal",
    "BuiltInDatatype": ".",
  }).render(QS('.clickable'));
}
