const Elts = {
  page: document.querySelector('#page');
}

const QS = document.querySelector;
const QSA = document.querySelectorAll;

document.onload=onLoad;

function log (className, msg) {
  const li = document.createElement('li');
  li.className = className;
  li.innerText = msg;
  QS('#messages').prepend(li);
}

async function onLoad () {
  console.log(arguments);
  const curDoc = null;
  if (curDoc)
    renderDoc(curDoc);
  else
    inputDoc();
}

async renderDoc(url) {
  const resp = await fetch(url);
  const body = await resp.text();
  if (!resp.ok)
    throw Error(`fetch(${url}) => ${resp.code}:\n${body}`);
  RenderClickableLd(QS('.clickable'), body, 'text/turtle');
}
