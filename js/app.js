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

// ─── Canvas drop zone setup ─────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
let activeItem = null;

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

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - 40;
  const y = e.clientY - rect.top - 40;

  try {
    const res = await fetch(file);
    const text = await res.text();

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'canvas-item');
    group.innerHTML = text;

    // Initialize transform state
    group.dataset.x = x;
    group.dataset.y = y;
    group.dataset.scale = 1;
    group.dataset.rotation = 0;

    canvas.appendChild(group);
    attachTransformControls(group);
    selectItem(group);

  } catch (err) {
    console.error('Could not load SVG:', file, err);
  }
});

// Deselect on clicking empty canvas
canvas.addEventListener('mousedown', e => {
  if (e.target === canvas) selectItem(null);
});

// ─── Transform Engine ────────────────────────────────────────────────────────
function updateTransform(el) {
  const x = parseFloat(el.dataset.x) || 0;
  const y = parseFloat(el.dataset.y) || 0;
  const scale = parseFloat(el.dataset.scale) || 1;
  const rot = parseFloat(el.dataset.rotation) || 0;

  // Retrieve item center point for smooth rotation & scaling
  const bbox = el.querySelector('svg')?.getBBox?.() || { width: 80, height: 80, x: 0, y: 0 };
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  // Apply matrix composition: Translate -> Rotate around center -> Scale
  el.setAttribute(
    'transform',
    `translate(${x}, ${y}) translate(${cx}, ${cy}) rotate(${rot}) scale(${scale}) translate(${-cx}, ${-cy})`
  );
}

function selectItem(el) {
  // Remove existing UI control boxes
  document.querySelectorAll('.ui-controls').forEach(ctrl => ctrl.remove());
  activeItem = el;
  if (!el) return;

  renderControls(el);
}

// ─── Transform & Interaction Controls ────────────────────────────────────────
function attachTransformControls(el) {
  updateTransform(el);

  // Drag to move
  el.addEventListener('mousedown', e => {
    e.stopPropagation();
    selectItem(el);

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = parseFloat(el.dataset.x);
    const origY = parseFloat(el.dataset.y);

    const onMove = mv => {
      el.dataset.x = origX + (mv.clientX - startX);
      el.dataset.y = origY + (mv.clientY - startY);
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

  // Quick scale with mouse scroll wheel over the element
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const currentScale = parseFloat(el.dataset.scale) || 1;
    const delta = e.deltaY * -0.001;
    el.dataset.scale = Math.max(0.1, Math.min(currentScale + delta, 5)).toFixed(3);
    updateTransform(el);
    updateControlsPosition(el);
  });
}

// ─── Overlay UI Handles (Resize & Rotate) ───────────────────────────────────
function renderControls(el) {
  const controlsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  controlsGroup.setAttribute('class', 'ui-controls');

  // Rotate Handle (Top)
  const rotHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  rotHandle.setAttribute('r', '7');
  rotHandle.setAttribute('fill', '#007bff');
  rotHandle.setAttribute('stroke', '#fff');
  rotHandle.setAttribute('stroke-width', '2');
  rotHandle.style.cursor = 'grab';

  // Resize Handle (Bottom-Right)
  const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  resizeHandle.setAttribute('width', '12');
  resizeHandle.setAttribute('height', '12');
  resizeHandle.setAttribute('fill', '#28a745');
  resizeHandle.setAttribute('stroke', '#fff');
  resizeHandle.setAttribute('stroke-width', '2');
  resizeHandle.style.cursor = 'nwse-resize';

  controlsGroup.appendChild(rotHandle);
  controlsGroup.appendChild(resizeHandle);
  canvas.appendChild(controlsGroup);

  // Rotation Handle Drag
  rotHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const bbox = el.getBoundingClientRect();
    const centerX = bbox.left + bbox.width / 2;
    const centerY = bbox.top + bbox.height / 2;

    const onMove = mv => {
      const radians = Math.atan2(mv.clientY - centerY, mv.clientX - centerX);
      let degrees = radians * (180 / Math.PI) - 90; // Align handle to 12 o'clock
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

  // Resize Handle Drag
  resizeHandle.addEventListener('mousedown', e => {
    e.stopPropagation();
    const startY = e.clientY;
    const initScale = parseFloat(el.dataset.scale) || 1;

    const onMove = mv => {
      const dy = mv.clientY - startY;
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

  // Position handles relative to the canvas coordinate space
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
  selectItem(null); // Clean up on-screen UI handles before exporting

  const serializer = new XMLSerializer();
  const svgData = serializer.serializeToString(canvas);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'tumbler-design.svg';
  link.click();

  URL.revokeObjectURL(url);
});
