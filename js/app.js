// ─── Define your SVG assets ─────────────────────────────────────────────────
async function loadAssets() {
  const res = await fetch('./js/assets.json');
  const assets = await res.json();
  const list = document.getElementById('assetList');

  list.innerHTML = assets.map(a => `
    <div class="asset" draggable="true" data-file="${a.file}">
      <img src="${a.preview}" alt="${a.name}">
      <span>${a.name}</span>
    </div>
  `).join('');

  list.querySelectorAll('.asset').forEach(item => {
    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', item.dataset.file);
      item.style.opacity = '0.4';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
    });
  });
}

loadAssets();

// ─── Canvas & Viewport Setup ────────────────────────────────────────────────
const canvas = document.getElementById('canvas');

// Ensure a dedicated viewport <g> exists so canvas-level zoom/pan doesn't break export
let viewport = canvas.querySelector('#viewport');
if (!viewport) {
  viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  viewport.setAttribute('id', 'viewport');
  canvas.appendChild(viewport);
}

let activeItem = null;

// Canvas Zoom & Pan state
const viewState = {
  scale: 1,
  x: 0,
  y: 0,
  isPanning: false,
  panStartX: 0,
  panStartY: 0
};

function updateViewportTransform() {
  viewport.setAttribute('transform', `translate(${viewState.x}, ${viewState.y}) scale(${viewState.scale})`);
  if (activeItem) updateControlsPosition(activeItem);
}

// Convert screen (client) coordinates to SVG viewport coordinates
function clientToViewport(clientX, clientY) {
  const pt = canvas.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(viewport.getScreenCTM().inverse());
}

// ─── Canvas Zoom & Pan Interactions ─────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();

  const zoomFactor = 1.1;
  const direction = e.deltaY < 0 ? 1 : -1;
  const factor = direction > 0 ? zoomFactor : 1 / zoomFactor;

  // Restrict zoom limits
  const newScale = Math.min(Math.max(viewState.scale * factor, 0.1), 10);
  if (newScale === viewState.scale) return;

  // Zoom centered on current mouse pointer
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  viewState.x = mouseX - (mouseX - viewState.x) * (newScale / viewState.scale);
  viewState.y = mouseY - (mouseY - viewState.y) * (newScale / viewState.scale);
  viewState.scale = newScale;

  updateViewportTransform();
}, { passive: false });

// Pan Canvas with Left-click on canvas background or Middle-click
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

// ─── Canvas Drop Zone Setup ─────────────────────────────────────────────────
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

  // Drop at accurate coordinates regardless of zoom/pan state
  const dropCoords = clientToViewport(e.clientX, e.clientY);

  try {
    const res = await fetch(file);
    const text = await res.text();

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'canvas-item');
    group.innerHTML = text;

    group.dataset.x = dropCoords.x - 40;
    group.dataset.y = dropCoords.y - 40;
    group.dataset.scale = 1;
    group.dataset.rotation = 0;

    viewport.appendChild(group);
    attachTransformControls(group);
    selectItem(group);

  } catch (err) {
    console.error('Could not load SVG:', file, err);
  }
});

// ─── Transform Engine ────────────────────────────────────────────────────────
function updateTransform(el) {
  const x = parseFloat(el.dataset.x) || 0;
  const y = parseFloat(el.dataset.y) || 0;
  const scale = parseFloat(el.dataset.scale) || 1;
  const rot = parseFloat(el.dataset.rotation) || 0;

  const bbox = el.querySelector('svg')?.getBBox?.() || { width: 80, height: 80, x: 0, y: 0 };
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  el.setAttribute(
    'transform',
    `translate(${x}, ${y}) translate(${cx}, ${cy}) rotate(${rot}) scale(${scale}) translate(${-cx}, ${-cy})`
  );
}

function selectItem(el) {
  document.querySelectorAll('.ui-controls').forEach(ctrl => ctrl.remove());
  activeItem = el;
  if (!el) return;
  renderControls(el);
}

// ─── Transform & Interaction Controls ────────────────────────────────────────
function attachTransformControls(el) {
  updateTransform(el);

  // Drag item across canvas (zoom-aware)
  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return; // Only left-click
    e.stopPropagation();
    selectItem(el);

    const startMouse = clientToViewport(e.clientX, e.clientY);
    const origX = parseFloat(el.dataset.x);
    const origY = parseFloat(el.dataset.y);

    const onMove = mv => {
      const currentMouse = clientToViewport(mv.clientX, mv.clientY);
      el.dataset.x = origX + (currentMouse.x - startMouse.x);
      el.dataset.y = origY + (currentMouse.y - startMouse.y);
      updateTransform(el);
      updateControlsPosition(el);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

// ─── Overlay UI Handles (Resize & Rotate) ───────────────────────────────────
function renderControls(el) {
  const controlsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  controlsGroup.setAttribute('class', 'ui-controls');

  // Rotate Handle (Top Circle)
  const rotHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  rotHandle.setAttribute('r', '7');
  rotHandle.setAttribute('fill', '#007bff');
  rotHandle.setAttribute('stroke', '#fff');
  rotHandle.setAttribute('stroke-width', '2');
  rotHandle.style.cursor = 'grab';

  // Resize Handle (Bottom-Right Box)
  const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  resizeHandle.setAttribute('width', '12');
  resizeHandle.setAttribute('height', '12');
  resizeHandle.setAttribute('fill', '#28a745');
  resizeHandle.setAttribute('stroke', '#fff');
  resizeHandle.setAttribute('stroke-width', '2');
  resizeHandle.style.cursor = 'nwse-resize';

  controlsGroup.appendChild(rotHandle);
  controlsGroup.appendChild(resizeHandle);
  canvas.appendChild(controlsGroup); // Placed at top-level SVG for stable handle sizes

  // Rotate Drag
  rotHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const bbox = el.getBoundingClientRect();
    const centerX = bbox.left + bbox.width / 2;
    const centerY = bbox.top + bbox.height / 2;

    const onMove = mv => {
      const radians = Math.atan2(mv.clientY - centerY, mv.clientX - centerX);
      let degrees = radians * (180 / Math.PI) - 90;
      el.dataset.rotation = degrees;
      updateTransform(el);
      updateControlsPosition(el);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // Resize Drag
  resizeHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const startY = e.clientY;
    const initScale = parseFloat(el.dataset.scale) || 1;

    const onMove = mv => {
      // Scale calculation accounts for canvas zoom level
      const dy = (mv.clientY - startY) / viewState.scale;
      const newScale = Math.max(0.1, initScale + dy * 0.01);
      el.dataset.scale = newScale.toFixed(3);
      updateTransform(el);
      updateControlsPosition(el);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  updateControlsPosition(el);
}

function updateControlsPosition(el) {
  const controls = document.querySelector('.ui-controls');
  if (!controls || !el) return;

  const canvasRect = canvas.getBoundingClientRect();
  const bbox = el.getBoundingClientRect();

  const left = bbox.left - canvasRect.left;
  const top = bbox.top - canvasRect.top;
  const width = bbox.width;
  const height = bbox.height;

  const rotHandle = controls.querySelector('circle');
  const resizeHandle = controls.querySelector('rect');

  rotHandle.setAttribute('cx', left + width / 2);
  rotHandle.setAttribute('cy', top - 15);

  resizeHandle.setAttribute('x', left + width - 6);
  resizeHandle.setAttribute('y', top + height - 6);
}

// ─── Export SVG ─────────────────────────────────────────────────────────────
document.getElementById('exportBtn').addEventListener('click', () => {
  selectItem(null);

  // Temporarily reset viewport pan/zoom so export reflects the clean base art
  const currentTransform = viewport.getAttribute('transform');
  viewport.removeAttribute('transform');

  const serializer = new XMLSerializer();
  const svgData = serializer.serializeToString(canvas);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'tumbler-design.svg';
  link.click();

  URL.revokeObjectURL(url);

  // Restore editor view
  if (currentTransform) viewport.setAttribute('transform', currentTransform);
});
