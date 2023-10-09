
const Elts = {
  pageInput: document.querySelector('#page input'),
  renderElement: document.querySelector('.clickable'),
  messagesList: document.querySelector('#messages ol'),
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
  Elts.pageInput.oninput = inputDoc;
  const params = new URLSearchParams(location.search);
  const browse = params.get('browse');
  if (browse) {
    Elts.pageInput.value = browse;
    inputDoc.call(Elts.pageInput, evt);
  }
}

async function inputDoc (evt) {
  if (this.value)
    renderDoc(this.value, document.location.href);
}

async function renderDoc (url, base) {
  const resp = await fetch(url);
  const body = await resp.text();
  if (!resp.ok)
    throw Error(`fetch(${url}) => ${resp.code}:\n${body}`);

  message(` ${new URL(url, base).href}`);
  Elts.renderElement.replaceChildren();

  new RenderClickableLd(document, base, body, 'text/turtle', {
    sparqlPrefix: {useParent: true},
    skipped: {useParent: true},
    namespace: {useParent: true},
    statementOrWs: {useParent: true},
    BuiltInDatatype: {useParent: true},

    pname: { className: "pname" },
    BLANK_NODE_LABEL: { className: "bnode" },
    ANON: { className: "bnode" },
    // blankNodePropertyList: { className: "blankNodePropertyList123" },
    "blankNodePropertyList/start": { className: "bnode" },
    "blankNodePropertyList/end": { className: "bnode" },
    collection: { className: "bnode" },
    simpleLiteral: { className: "literal" },
    datatypedLiteral: { className: "literal" },
    langTagLiteral: { className: "literal" },
  }).render(Elts.renderElement);
  document.title = url;
}

function message (content) {
  const li = document.createElement('li');
  li.append(content);
  Elts.messagesList.append(li);
}
