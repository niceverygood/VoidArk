// Keep the live radar's labels attached: replacing HTML on every sample also
// invalidates the unchanged legend and reparses the same status/label elements.
export function createBattleRadarDisplay(status, labels) {
  const document = status.ownerDocument;
  const caption = document.createElement('span'), counts = document.createElement('strong');
  caption.textContent = '전장 · 300m';
  status.replaceChildren(caption, counts);
  const entries = [];
  let lastCounts = '';
  return function update(view) {
    const nextCounts = '적 ' + view.hostiles + ' · 보스 ' + view.bosses.length;
    if (nextCounts !== lastCounts) { counts.textContent = nextCounts; lastCounts = nextCounts; }
    for (let i = 0; i < view.labels.length; i++) {
      const label = view.labels[i];
      let entry = entries[i];
      if (!entry) {
        entry = {node: document.createElement('span')};
        entries.push(entry); labels.appendChild(entry.node);
      }
      const left = 'clamp(58px,' + label.left + '%,calc(100% - 58px))', top = label.top + '%';
      if (entry.text !== label.text) { entry.node.textContent = label.text; entry.text = label.text; }
      if (entry.color !== label.color) { entry.node.style.color = label.color; entry.color = label.color; }
      if (entry.left !== left) { entry.node.style.left = left; entry.left = left; }
      if (entry.top !== top) { entry.node.style.top = top; entry.top = top; }
    }
    while (entries.length > view.labels.length) entries.pop().node.remove();
  };
}
