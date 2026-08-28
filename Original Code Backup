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

// Required — without this the drop event never fires
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

  // Calculate drop position relative to the canvas
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - 40;
  const y = e.clientY - rect.top  - 40;

  try {
    // Fetch and inline the SVG so it renders on the canvas
    const res  = await fetch(file);
    const text = await res.text();

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${x}, \${y})`);
    group.setAttribute('class', 'canvas-item');
    group.innerHTML = text;

    makeDraggable(group);
    canvas.appendChild(group);

  } catch (err) {
    console.error('Could not load SVG:', file, err);
  }
});

// ─── Move items around once on the canvas ───────────────────────────────────
function makeDraggable(el) {
  let startX, startY, origX, origY;

  el.addEventListener('mousedown', e => {
    e.stopPropagation();

    const transform = el.getAttribute('transform') || 'translate(0,0)';
    const match = transform.match(/translate$([^,]+),([^)]+)$/);
    origX = match ? parseFloat(match[1]) : 0;
    origY = match ? parseFloat(match[2]) : 0;
    startX = e.clientX;
    startY = e.clientY;

    const onMove = mv => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      el.setAttribute('transform', `translate(${origX + dx}, \${origY + dy})`);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

// ─── Export SVG ─────────────────────────────────────────────────────────────
document.getElementById('exportBtn').addEventListener('click', () => {
  const serializer = new XMLSerializer();
  const svgData    = serializer.serializeToString(canvas);
  const blob       = new Blob([svgData], { type: 'image/svg+xml' });
  const url        = URL.createObjectURL(blob);

  const link    = document.createElement('a');
  link.href     = url;
  link.download = 'tumbler-design.svg';
  link.click();

  URL.revokeObjectURL(url);
});
