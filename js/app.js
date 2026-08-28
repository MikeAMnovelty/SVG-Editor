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
    });
  });
}

loadAssets();

document.getElementById('exportBtn').addEventListener('click', async () => {
  alert('Connect this to your SVG export logic and upload endpoint.');
});
