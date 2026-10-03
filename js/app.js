import { uploadSVGToS3 } from '/js/lib/s3Upload.js';

async function loadAssets() {
  const res = await fetch('/js/assets.json');
  const data = await res.json();
  const list = document.getElementById('assetList');
  list.innerHTML = '';
  list.appendChild(renderNodes(data));
}

function renderNodes(nodes) {
  const container = document.createElement('div');

  nodes.forEach(n => {
    if (n.type === 'folder') {
      const folder = document.createElement('div');
      folder.className = 'folder';
      const header = document.createElement('div');
      header.className = 'folder-header';
      header.textContent = '▸ ' + n.name;
      folder.appendChild(header);

      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'folder-children';
      childrenWrap.style.display = 'none';
      childrenWrap.appendChild(renderNodes(n.children || []));
      folder.appendChild(childrenWrap);

      header.addEventListener('click', () => {
        const open = childrenWrap.style.display === 'block';
        childrenWrap.style.display = open ? 'none' : 'block';
        header.textContent = (open ? '▸ ' : '▾ ') + n.name;
      });

      container.appendChild(folder);
    } else if (n.type === 'file') {
      const item = document.createElement('div');
      item.className = 'asset';
      item.draggable = true;
      item.dataset.file = n.file;
      item.innerHTML = `<img src="${n.file}" alt="${n.name}"><span>${n.name}</span>`;

      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', item.dataset.file);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));

      container.appendChild(item);
    }
  });

  return container;
}

loadAssets();

// ─── Canvas & Viewport Setup ──────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const viewport = canvas.querySelector('#viewport');
const svgNS    = 'http://www.w3.org/2000/svg';
const PPI      = 72;

let activeItem     = null;
let activeTextItem = null;

const viewState = {
  scale: 1,
  x: 0,
  y: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0
};

function updateViewportTransform() {
  viewport.setAttribute('transform',
    'translate(' + viewState.x + ', ' + viewState.y + ') scale(' + viewState.scale + ')');
  if (activeItem) updateControlsPosition(activeItem);
}

function clientToViewport(clientX, clientY) {
  const pt = canvas.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(viewport.getScreenCTM().inverse());
}

// ─── Zoom & Pan ───────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const zoomFactor = 1.1;
  const direction  = e.deltaY < 0 ? 1 : -1;
  const factor     = direction > 0 ? zoomFactor : 1 / zoomFactor;
  const newScale   = Math.min(Math.max(viewState.scale * factor, 0.1), 10);
  if (newScale === viewState.scale) return;

  const rect   = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  viewState.x     = mouseX - (mouseX - viewState.x) * (newScale / viewState.scale);
  viewState.y     = mouseY - (mouseY - viewState.y) * (newScale / viewState.scale);
  viewState.scale = newScale;
  updateViewportTransform();
}, { passive: false });

canvas.addEventListener('mousedown', e => {
  if (e.target === canvas || e.button === 1) {
    selectItem(null);
    viewState.isPanning = true;
    viewState.panStartX = e.clientX - viewState.x;
    viewState.panStartY = e.clientY - viewState.y;
    canvas.style.cursor = 'grabbing';
  }
});

window.addEventListener('mousemove', e => {
  if (!viewState.isPanning) return;
  viewState.x = e.clientX - viewState.panStartX;
  viewState.y = e.clientY - viewState.panStartY;
  updateViewportTransform();
});

window.addEventListener('mouseup', () => {
  if (viewState.isPanning) {
    viewState.isPanning = false;
    canvas.style.cursor = 'default';
  }
});

// ─── Canvas Drop Zone ─────────────────────────────────────────────────────────
canvas.addEventListener('dragover', e => {
  e.preventDefault();
  canvas.style.outline = '2px dashed #aac';
});

canvas.addEventListener('dragleave', () => {
  canvas.style.outline = '';
});

canvas.addEventListener('drop', async e => {
  e.preventDefault();
  canvas.style.outline = '';

  const file = e.dataTransfer.getData('text/plain');
  if (!file) return;

  const dropCoords = clientToViewport(e.clientX, e.clientY);

  try {
    const res  = await fetch(file);
    const text = await res.text();

    const parser = new DOMParser();
    const doc    = parser.parseFromString(text, 'image/svg+xml');
    const srcSvg = doc.documentElement;

    let iw = 0, ih = 0;
    const vb = srcSvg.getAttribute('viewBox');
    if (vb) {
      const parts = vb.trim().split(/\s+|,/).map(Number);
      iw = parts[2]; ih = parts[3];
    } else {
      iw = parseFloat(srcSvg.getAttribute('width')  || 0);
      ih = parseFloat(srcSvg.getAttribute('height') || 0);
    }
    if (!iw || !ih) { iw = 100; ih = 100; }

    const renderW = 100;
    const renderH = (ih / iw) * renderW;

    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('class', 'canvas-item');

    const nested = document.createElementNS(svgNS, 'svg');
    nested.setAttribute('viewBox', '0 0 ' + iw + ' ' + ih);
    nested.setAttribute('width',    renderW);
    nested.setAttribute('height',   renderH);
    nested.setAttribute('x',        0);
    nested.setAttribute('y',        0);
    nested.setAttribute('overflow', 'visible');

    Array.from(srcSvg.childNodes).forEach(child => {
      nested.appendChild(doc.importNode(child, true));
    });

    group.appendChild(nested);

    group.dataset.x        = dropCoords.x - renderW / 2;
    group.dataset.y        = dropCoords.y - renderH / 2;
    group.dataset.w        = renderW;
    group.dataset.h        = renderH;
    group.dataset.rotation = 0;

    viewport.appendChild(group);
    updateTransform(group);

    setTimeout(() => {
      attachTransformControls(group);
      selectItem(group);
      if (window.checkArtworkBounds) window.checkArtworkBounds();
    }, 0);

  } catch (err) {
    console.error('Could not load SVG:', file, err);
  }
});

// ─── Transform Engine ─────────────────────────────────────────────────────────
function updateTransform(el) {
  const x   = parseFloat(el.dataset.x)        || 0;
  const y   = parseFloat(el.dataset.y)        || 0;
  const w   = parseFloat(el.dataset.w)        || 100;
  const h   = parseFloat(el.dataset.h)        || 100;
  const rot = parseFloat(el.dataset.rotation) || 0;

  const cx = x + w / 2;
  const cy = y + h / 2;

  el.setAttribute('transform', 'rotate(' + rot + ', ' + cx + ', ' + cy + ')');

  const nested = el.querySelector('svg');
  if (nested) {
    nested.setAttribute('x',        x);
    nested.setAttribute('y',        y);
    nested.setAttribute('width',    w);
    nested.setAttribute('height',   h);
    nested.setAttribute('overflow', 'hidden');
  }
}

// ─── Select Item ──────────────────────────────────────────────────────────────
function selectItem(el) {
  document.querySelectorAll('.ui-controls').forEach(ctrl => ctrl.remove());
  activeItem = el;

  if (el && !el.classList.contains('text-item')) hideTextToolbar();
  if (!el) hideTextToolbar();
  if (!el) return;

  renderControls(el);
}

// ─── Text Item Selection ──────────────────────────────────────────────────────
function selectTextItem(el) {
  document.querySelectorAll('.ui-controls').forEach(ctrl => ctrl.remove());
  activeItem     = null;
  activeTextItem = el;

  const toolbar   = document.getElementById('text-toolbar');
  const fontBtn   = document.getElementById('tb-font-btn');
  const sizeLabel = document.getElementById('tb-size-label');

  if (fontBtn) {
    fontBtn.textContent      = el.dataset.fontFamily || 'Font';
    fontBtn.style.fontFamily = `'${el.dataset.fontFamily}', sans-serif`;
  }
  if (sizeLabel) sizeLabel.textContent = (el.dataset.fontSize || 36) + 'px';
  if (toolbar)   toolbar.style.display = 'flex';

  attachTextDrag(el);
}

// ─── Apply Font to Selected Text Element ─────────────────────────────────────
window.applyFontToSelected = function(fontName) {
  const el = activeTextItem;
  if (!el) return;
  const textEl = el.querySelector('text');
  if (!textEl) return;
  textEl.setAttribute('font-family', `'${fontName}', sans-serif`);
  el.dataset.fontFamily = fontName;

  const fontBtn = document.getElementById('tb-font-btn');
  if (fontBtn) {
    fontBtn.textContent      = fontName;
    fontBtn.style.fontFamily = `'${fontName}', sans-serif`;
  }
};

// ─── Text Item Drag ───────────────────────────────────────────────────────────
function attachTextDrag(el) {
  if (el._dragAttached) return;
  el._dragAttached = true;
  el.style.cursor  = 'move';

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectTextItem(el);

    const startMouse = clientToViewport(e.clientX, e.clientY);
    const nested     = el.querySelector('svg');
    const origX      = parseFloat(nested.getAttribute('x')) || 0;
    const origY      = parseFloat(nested.getAttribute('y')) || 0;

    const onMove = mv => {
      const cur  = clientToViewport(mv.clientX, mv.clientY);
      const newX = origX + (cur.x - startMouse.x);
      const newY = origY + (cur.y - startMouse.y);
      nested.setAttribute('x', newX);
      nested.setAttribute('y', newY);
      el.dataset.x = newX;
      el.dataset.y = newY;
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });
}

// ─── Hide Text Toolbar ────────────────────────────────────────────────────────
function hideTextToolbar() {
  const toolbar = document.getElementById('text-toolbar');
  if (toolbar) toolbar.style.display = 'none';
  activeTextItem = null;
}

// ─── Get Snap Target ─────────────────────────────────────────────────────────
function getSnapTarget() {
  // Read the active template shapes exposed by index.html
  const shapes = window.activeShapes;
  if (!shapes || shapes.length === 0) return null;
  const s = shapes[0];
  if (s.type === 'rect') {
    return {
      x: s.xIn * PPI,
      y: s.yIn * PPI,
      w: s.wIn * PPI,
      h: s.hIn * PPI
    };
  } else if (s.type === 'circle') {
    const r = s.rIn * PPI;
    return {
      x: (s.cxIn - s.rIn) * PPI,
      y: (s.cyIn - s.rIn) * PPI,
      w: r * 2,
      h: r * 2
    };
  }
  return null;
}

// ─── Add Text Element ─────────────────────────────────────────────────────────
function addTextElement() {
  const target      = getSnapTarget();
  const defaultFont = 'Blackcraft';
  const fontSize    = 36;

  const x = target ? target.x : 100;
  const y = target ? target.y : 100;
  const w = target ? target.w : 200;
  const h = target ? target.h : 60;

  const g = document.createElementNS(svgNS, 'g');
  g.classList.add('canvas-item', 'text-item');
  g.dataset.fontFamily = defaultFont;
  g.dataset.fontSize   = fontSize;
  g.dataset.x          = x;
  g.dataset.y          = y;
  g.dataset.w          = w;
  g.dataset.h          = h;
  g.dataset.rotation   = 0;

  const nested = document.createElementNS(svgNS, 'svg');
  nested.setAttribute('x',        x);
  nested.setAttribute('y',        y);
  nested.setAttribute('width',    w);
  nested.setAttribute('height',   h);
  nested.setAttribute('overflow', 'visible');

  const textEl = document.createElementNS(svgNS, 'text');
  textEl.setAttribute('x',                '50%');
  textEl.setAttribute('y',                '50%');
  textEl.setAttribute('dominant-baseline', 'middle');
  textEl.setAttribute('text-anchor',       'middle');
  textEl.setAttribute('fill',              '#000000');
  textEl.setAttribute('font-family',       `'${defaultFont}', sans-serif`);
  textEl.setAttribute('font-size',         fontSize);
  textEl.textContent = 'Your Text Here';

  nested.appendChild(textEl);
  g.appendChild(nested);
  viewport.appendChild(g);

  selectTextItem(g);
}

// ─── Text Toolbar Button Listeners ───────────────────────────────────────────
document.getElementById('addTextBtn').addEventListener('click', addTextElement);

document.getElementById('tb-font-btn').addEventListener('click', () => {
  const panel = document.getElementById('font-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('tb-size-down').addEventListener('click', () => {
  if (!activeTextItem) return;
  const textEl = activeTextItem.querySelector('text');
  const size   = Math.max(6, parseFloat(activeTextItem.dataset.fontSize) - 2);
  activeTextItem.dataset.fontSize = size;
  textEl.setAttribute('font-size', size);
  document.getElementById('tb-size-label').textContent = size + 'px';
});

document.getElementById('tb-size-up').addEventListener('click', () => {
  if (!activeTextItem) return;
  const textEl = activeTextItem.querySelector('text');
  const size   = Math.min(300, parseFloat(activeTextItem.dataset.fontSize) + 2);
  activeTextItem.dataset.fontSize = size;
  textEl.setAttribute('font-size', size);
  document.getElementById('tb-size-label').textContent = size + 'px';
});

document.getElementById('tb-edit-btn').addEventListener('click', () => {
  if (!activeTextItem) return;
  const textEl  = activeTextItem.querySelector('text');
  const newText = window.prompt('Edit text:', textEl.textContent);
  if (newText !== null) textEl.textContent = newText;
});

document.getElementById('tb-delete-btn').addEventListener('click', () => {
  if (!activeTextItem) return;
  activeTextItem.remove();
  hideTextToolbar();
});

// ─── Delete Selected (artwork or text) ────────────────────────────────────────
function deleteSelected() {
  if (activeItem) {
    activeItem.remove();
    selectItem(null);
    if (window.checkArtworkBounds) window.checkArtworkBounds();
    return;
  }
  if (activeTextItem) {
    activeTextItem.remove();
    hideTextToolbar();
  }
}

document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && (activeItem || activeTextItem)) {
    e.preventDefault();
    deleteSelected();
  }
});

document.getElementById('deleteBtn').addEventListener('click', deleteSelected);

// ─── Text Item Click-to-Select ────────────────────────────────────────────────
viewport.addEventListener('mousedown', e => {
  const textItem = e.target.closest('.text-item');
  if (textItem) {
    e.stopPropagation();
    selectTextItem(textItem);
  }
});

// ─── Transform & Interaction Controls ────────────────────────────────────────
function attachTransformControls(el) {
  updateTransform(el);

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectItem(el);

    const startMouse = clientToViewport(e.clientX, e.clientY);
    const origX      = parseFloat(el.dataset.x);
    const origY      = parseFloat(el.dataset.y);

    const onMove = mv => {
      const currentMouse = clientToViewport(mv.clientX, mv.clientY);
      el.dataset.x = origX + (currentMouse.x - startMouse.x);
      el.dataset.y = origY + (currentMouse.y - startMouse.y);
      updateTransform(el);
      updateControlsPosition(el);
      if (window.checkArtworkBounds) window.checkArtworkBounds();
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });
}

// ─── Overlay UI Handles (Resize & Rotate) ────────────────────────────────────
function renderControls(el) {
  const controlsGroup = document.createElementNS(svgNS, 'g');
  controlsGroup.setAttribute('class', 'ui-controls');

  const rotHandle = document.createElementNS(svgNS, 'circle');
  rotHandle.setAttribute('r',            '7');
  rotHandle.setAttribute('fill',         '#007bff');
  rotHandle.setAttribute('stroke',       '#fff');
  rotHandle.setAttribute('stroke-width', '2');
  rotHandle.style.cursor = 'grab';

  const resizeHandle = document.createElementNS(svgNS, 'rect');
  resizeHandle.setAttribute('width',        '12');
  resizeHandle.setAttribute('height',       '12');
  resizeHandle.setAttribute('fill',         '#28a745');
  resizeHandle.setAttribute('stroke',       '#fff');
  resizeHandle.setAttribute('stroke-width', '2');
  resizeHandle.style.cursor = 'nwse-resize';

  controlsGroup.appendChild(rotHandle);
  controlsGroup.appendChild(resizeHandle);
  canvas.appendChild(controlsGroup);

  // Rotate
  rotHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const bbox    = el.getBoundingClientRect();
    const centerX = bbox.left + bbox.width  / 2;
    const centerY = bbox.top  + bbox.height / 2;

    const onMove = mv => {
      const radians       = Math.atan2(mv.clientY - centerY, mv.clientX - centerX);
      el.dataset.rotation = radians * (180 / Math.PI) - 90;
      updateTransform(el);
      updateControlsPosition(el);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  // Resize
  resizeHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const startX = e.clientX;
    const initW  = parseFloat(el.dataset.w);
    const initH  = parseFloat(el.dataset.h);
    const aspect = initH / initW;

    const onMove = mv => {
      const dx     = (mv.clientX - startX) / viewState.scale;
      const newW   = Math.max(10, initW + dx);
      el.dataset.w = newW.toFixed(1);
      el.dataset.h = (newW * aspect).toFixed(1);
      updateTransform(el);
      updateControlsPosition(el);
      if (window.checkArtworkBounds) window.checkArtworkBounds();
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  });

  updateControlsPosition(el);
}

function updateControlsPosition(el) {
  const controls = document.querySelector('.ui-controls');
  if (!controls || !el) return;

  const canvasRect = canvas.getBoundingClientRect();
  const bbox       = el.getBoundingClientRect();

  const left   = bbox.left   - canvasRect.left;
  const top    = bbox.top    - canvasRect.top;
  const width  = bbox.width;
  const height = bbox.height;

  controls.querySelector('circle').setAttribute('cx', left + width / 2);
  controls.querySelector('circle').setAttribute('cy', top - 15);
  controls.querySelector('rect').setAttribute('x',    left + width  - 6);
  controls.querySelector('rect').setAttribute('y',    top  + height - 6);
}

// ─── Export & Upload to S3 ────────────────────────────────────────────────────
document.getElementById('exportBtn').addEventListener('click', async () => {
  selectItem(null);
  hideTextToolbar();

  const currentTransform = viewport.getAttribute('transform');
  viewport.removeAttribute('transform');

  try {
    const serializer = new XMLSerializer();
    const svgData    = serializer.serializeToString(canvas);
    const blob       = new Blob([svgData], { type: 'image/svg+xml' });

    const fileName = prompt('Enter a name for your design:', 'tumbler-design');
    if (fileName) {
      console.log('Attempting cloud upload...');
      const fileForS3 = new File([blob], `${fileName}.svg`, { type: 'image/svg+xml' });
      await uploadSVGToS3(fileForS3);
      console.log('Cloud upload successful!');

      window.parent.postMessage({
        type:     'upload-complete',
        fileName: `${fileName}.svg`
      }, '*');
    }

  } catch (error) {
    console.error('Operation failed:', error);
  } finally {
    if (currentTransform) viewport.setAttribute('transform', currentTransform);
    console.log('Editor view restored.');
  }
});
