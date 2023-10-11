const Elts = {
  pageInput: document.querySelector('#page input'),
  renderElement: document.querySelector('.clickable'),
  messagesList: document.querySelector('#messages ol'),
  popup: document.querySelector('#popup-window'),
  popupContents: document.querySelector('#popup-window p'),
};

let HpJson = null;

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

async function renderDoc (urlStr, oldBase) {
  const docBase = new URL(urlStr, oldBase);
  const resp = await fetch(docBase);
  const body = await resp.text();
  if (!resp.ok)
    throw Error(`fetch(${urlStr}) => ${resp.code}:\n${body}`);

  message(` ${new URL(urlStr, oldBase).href}`);
  Elts.renderElement.replaceChildren(); // clear out rendering area

  const contentType = resp.headers.get("Content-Type");
  if (contentType && contentType !== 'text/turtle')
    throw Error(`media type ${contentType} not supported; only "text/turtle" for now`);

  const parser = new TurtleParser.TurtleParser({baseIRI: docBase.href});
  const parseTree = parser.parse(body);

  new RenderClickableLd(document, {
    sparqlPrefix: {useParent: true},
    skipped: {useParent: true},
    namespace: {useParent: true},
    statementOrWs: {useParent: true},
    BuiltInDatatype: {useParent: true},

    pname: { construct: makeLink.bind(null, docBase) },
    relativeUrl: { construct: makeLink.bind(null, docBase) },
    BLANK_NODE_LABEL: { className: "bnode" },
    ANON: { className: "bnode" },
    // blankNodePropertyList: { className: "blankNodePropertyList123" },
    "blankNodePropertyList/start": { className: "bnode" },
    "blankNodePropertyList/end": { className: "bnode" },
    collection: { className: "bnode" },
    simpleLiteral: { className: "literal" },
    datatypedLiteral: { className: "literal" },
    langTagLiteral: { className: "literal" },
  }).render(parseTree, Elts.renderElement);

  document.title = urlStr;
}

const InternalLinks = new Map();

function makeLink (referrer, elementType, turtleElement, parentDomElement) {
  const referrUrl = new URL(referrer);
  const targetUrl = new URL(turtleElement.value);
  const targetUrlStr = targetUrl.href;
  const neighbor = referrUrl.protocol === targetUrl.protocol
        && referrUrl.host === targetUrl.host;
  const inDoc = neighbor
        && referrUrl.pathname === targetUrl.pathname
        && referrUrl.search === targetUrl.search;
  const element = document.createElement('a');
  element.setAttribute('href', turtleElement.value);
  if (inDoc) {
    element.classList.add("internalOverride");
    let elements = null;
    if (InternalLinks.has(targetUrlStr)) {
      elements = InternalLinks.get(targetUrlStr);
    } else {
      InternalLinks.set(targetUrlStr, (elements = []));
    }
    elements.push(element);

    element.addEventListener('mouseover', async evt => {
      for (const cousin of elements)
        cousin.classList.add("highlighted");
    });
    element.addEventListener('mouseout', async evt => {
      for (const cousin of elements)
        cousin.classList.remove("highlighted");
    });
  } else if (neighbor) {
    element.classList.add("neighbor");
  } else {

    if (targetUrlStr.startsWith('http://purl.obolibrary.org/obo/HP_')) {
      if (HpJson === null) {
        HpJson = fetch("https://github.com/obophenotype/human-phenotype-ontology/releases/latest/download/hp.json")
          .then(resp => resp.text())
          .then(text => JSON.parse(text).graphs[0].nodes)
          .catch(e => {console.log(e instanceof Error); throw e;});
      }
      HpJson
        .then(nodes => popup(element, JSON.stringify((nodes.find(n => n.id === targetUrlStr)))))
        .catch(e => popup(element, e.message.substring(0, 10)));
    }
  }
  parentDomElement.append(element);
  element.addEventListener('click', async evt => {
    // evt.stopPropagation();
    // if (!inDoc) return; // follow link
    evt.preventDefault();
  });
  // element.addEventListener('click', (event) => event.preventDefault());
  return element;
}

function popup (element, text) {
  element.addEventListener('mouseover', async evt => {
    Object.assign(Elts.popup.style, {
      left: `${evt.pageX + element.scrollLeft - element.offsetLeft}px`,
      top:  `${evt.pageY + element.scrollTop - element.offsetTop}px`,
      display: `block`,
    });
    Elts.popupContents.innerText = text;
  });
  element.addEventListener("mouseout", function() {
    Elts.popup.style.display = "none";
  });
}

function message (content) {
  const li = document.createElement('li');
  li.append(content);
  Elts.messagesList.append(li);
}
