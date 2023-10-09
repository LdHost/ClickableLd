
const Elts = {
  page: document.querySelector('#page')
};

const QS = document.querySelector.bind(document);
const QSA = document.querySelectorAll.bind(document);

// window.addEventListener("load", onLoad);
document.addEventListener("DOMContentLoaded", onLoad);

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
    sparqlPrefix: {useParent: true},
    skipped: {useParent: true},
    namespace: {useParent: true},
    statement: {useParent: true},
    BuiltInDatatype: {useParent: true},

    pname: { className: "pname" },
    BLANK_NODE_LABEL: { className: "bnode" },
    ANON: { className: "bnode" },
    blankNodePropertyList: { className: "bnode" },
    collection: { className: "bnode" },
    simpleLiteral: { className: "literal" },
    datatypedLiteral: { className: "literal" },
    langTagLiteral: { className: "literal" },
  }).render(QS('.clickable'));
}
