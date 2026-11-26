(() => {
  const canvas = document.querySelector('#whiteboard');
  const ctx = canvas.getContext('2d');
  const paper = document.querySelector('#paper');
  const emptyState = document.querySelector('#emptyState');
  const status = document.querySelector('#boardStatus');
  const sizeInput = document.querySelector('#strokeSize');
  const sizeValue = document.querySelector('#sizeValue');
  const sizePreview = document.querySelector('#sizePreview');
  const undoButton = document.querySelector('#undoButton');
  const redoButton = document.querySelector('#redoButton');
  const STORAGE_KEY = 'chalkboard-sketch-v1';
  let strokes = [];
  let redoStack = [];
  let currentStroke = null;
  let activeTool = 'pen';
  let activeColor = '#27283a';
  let strokeSize = 4;
  let drawing = false;
  let panning = false;
  let spaceDown = false;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let lastPoint = null;
  let saveTimer;
  let toastTimer;
  let title = 'Untitled lesson';

  function resizeCanvas() {
    const rect = paper.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function redraw() {
    const { width, height } = paper.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    for (const stroke of strokes) drawStroke(stroke);
    emptyState.classList.toggle('hidden', strokes.length > 0);
    updateHistoryButtons();
  }

  function drawStroke(stroke) {
    if (!stroke.points.length) return;
    const { width, height } = paper.getBoundingClientRect();
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.size;
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.28 : 1;
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    const first = stroke.points[0];
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    if (stroke.points.length === 1) {
      ctx.lineTo(first.x * width + 0.01, first.y * height + 0.01);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        ctx.lineTo(point.x * width, point.y * height);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function pointFromEvent(event) {
    const rect = paper.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function beginDraw(event) {
    if (spaceDown || event.button > 0) {
      panning = true;
      lastPoint = { x: event.clientX - pan.x, y: event.clientY - pan.y };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    currentStroke = { tool: activeTool, color: activeColor, size: activeTool === 'highlighter' ? strokeSize * 2.5 : strokeSize, points: [point] };
    strokes.push(currentStroke);
    drawStroke(currentStroke);
    emptyState.classList.add('hidden');
    status.textContent = 'Drawing…';
  }

  function moveDraw(event) {
    if (panning) {
      pan.x = event.clientX - lastPoint.x;
      pan.y = event.clientY - lastPoint.y;
      applyTransform();
      return;
    }
    if (!drawing || !currentStroke) return;
    currentStroke.points.push(pointFromEvent(event));
    drawStroke(currentStroke);
  }

  function endDraw() {
    if (panning) { panning = false; return; }
    if (!drawing) return;
    drawing = false;
    currentStroke = null;
    redoStack = [];
    updateHistoryButtons();
    status.textContent = 'Saved on this device';
    scheduleSave();
  }

  function updateHistoryButtons() {
    undoButton.disabled = strokes.length === 0;
    redoButton.disabled = redoStack.length === 0;
  }

  function undo() {
    if (!strokes.length) return;
    redoStack.push(strokes.pop());
    redraw(); scheduleSave(); status.textContent = 'Change undone';
  }

  function redo() {
    if (!redoStack.length) return;
    strokes.push(redoStack.pop());
    redraw(); scheduleSave(); status.textContent = 'Change restored';
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ strokes, title })); }
      catch { showToast('Could not save this board in your browser.'); }
    }, 250);
  }

  function loadSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.strokes)) strokes = saved.strokes;
      if (saved && typeof saved.title === 'string') title = saved.title;
    } catch { localStorage.removeItem(STORAGE_KEY); }
    document.querySelector('.board-heading h1').textContent = title;
    redraw();
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  function setZoom(next) {
    zoom = Math.max(0.7, Math.min(1.5, next));
    paper.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    const text = `${Math.round(zoom * 100)}%`;
    document.querySelector('#zoomValue').textContent = text;
    document.querySelector('#zoomValueMobile').textContent = text;
  }

  function applyTransform() { setZoom(zoom); }

  function exportPNG() {
    const rect = paper.getBoundingClientRect();
    const ratio = 2;
    const output = document.createElement('canvas');
    output.width = Math.round(rect.width * ratio);
    output.height = Math.round(rect.height * ratio);
    const out = output.getContext('2d');
    out.scale(ratio, ratio);
    out.fillStyle = '#ffffff';
    out.fillRect(0, 0, rect.width, rect.height);
    if (paper.classList.contains('grid')) {
      out.fillStyle = '#d9dbe5';
      for (let x = 0; x < rect.width; x += 20) for (let y = 0; y < rect.height; y += 20) {
        out.beginPath(); out.arc(x, y, .8, 0, Math.PI * 2); out.fill();
      }
    }
    for (const stroke of strokes) {
      if (!stroke.points.length) continue;
      out.save(); out.lineCap = 'round'; out.lineJoin = 'round'; out.lineWidth = stroke.size;
      out.strokeStyle = stroke.color; out.globalAlpha = stroke.tool === 'highlighter' ? .28 : 1;
      out.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      out.beginPath();
      out.moveTo(stroke.points[0].x * rect.width, stroke.points[0].y * rect.height);
      for (let i = 1; i < stroke.points.length; i++) out.lineTo(stroke.points[i].x * rect.width, stroke.points[i].y * rect.height);
      if (stroke.points.length === 1) out.lineTo(stroke.points[0].x * rect.width + .01, stroke.points[0].y * rect.height + .01);
      out.stroke(); out.restore();
    }
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'whiteboard'}.png`;
    link.href = output.toDataURL('image/png'); link.click();
    showToast('Your whiteboard was exported as a PNG.');
  }

  canvas.addEventListener('pointerdown', beginDraw);
  canvas.addEventListener('pointermove', moveDraw);
  canvas.addEventListener('pointerup', endDraw);
  canvas.addEventListener('pointercancel', endDraw);
  canvas.addEventListener('lostpointercapture', endDraw);
  document.querySelectorAll('.tool-button[data-tool]').forEach(button => button.addEventListener('click', () => {
    activeTool = button.dataset.tool;
    document.querySelectorAll('.tool-button[data-tool]').forEach(item => item.classList.toggle('active', item === button));
    canvas.style.cursor = activeTool === 'eraser' ? 'cell' : 'crosshair';
    status.textContent = `${button.querySelector('small').textContent} selected`;
  }));
  document.querySelectorAll('.color-swatch').forEach(button => button.addEventListener('click', () => {
    activeColor = button.dataset.color;
    document.querySelectorAll('.color-swatch').forEach(item => item.classList.toggle('selected', item === button));
  }));
  document.querySelector('#customColor').addEventListener('input', event => {
    activeColor = event.target.value;
    document.querySelectorAll('.color-swatch').forEach(item => item.classList.remove('selected'));
  });
  sizeInput.addEventListener('input', () => {
    strokeSize = Number(sizeInput.value);
    sizeValue.value = strokeSize;
    sizePreview.style.width = `${Math.max(4, strokeSize)}px`;
    sizePreview.style.height = `${Math.max(4, strokeSize)}px`;
  });
  undoButton.addEventListener('click', undo);
  redoButton.addEventListener('click', redo);
  document.querySelector('#clearButton').addEventListener('click', () => document.querySelector('#clearDialog').showModal());
  document.querySelector('#confirmClear').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('#clearDialog').close();
    if (strokes.length) { redoStack.push(...strokes); strokes = []; redraw(); scheduleSave(); status.textContent = 'Board cleared'; }
  });
  document.querySelector('#gridButton').addEventListener('click', event => {
    const button = event.currentTarget;
    const enabled = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(enabled)); paper.classList.toggle('grid', enabled);
  });
  document.querySelector('#downloadButton').addEventListener('click', exportPNG);
  document.querySelector('#zoomButton').addEventListener('click', () => setZoom(1));
  document.querySelector('#zoomOutMobile').addEventListener('click', () => setZoom(zoom - .1));
  document.querySelector('#zoomInMobile').addEventListener('click', () => setZoom(zoom + .1));
  document.querySelector('#editTitle').addEventListener('click', () => {
    const next = window.prompt('Name your lesson', title);
    if (next && next.trim()) { title = next.trim(); document.querySelector('.board-heading h1').textContent = title; scheduleSave(); }
  });
  document.querySelector('#shareButton').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Board link copied. Note: this prototype is stored only on this device.');
    } catch { showToast('This prototype is stored only on this device—export a PNG to share your work.'); }
  });
  document.querySelector('#roleSelect').addEventListener('change', event => showToast(`${event.target.value} view selected`));
  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) { spaceDown = true; event.preventDefault(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      const key = event.key.toLowerCase();
      const tool = { p: 'pen', h: 'highlighter', e: 'eraser' }[key];
      if (tool) document.querySelector(`[data-tool="${tool}"]`).click();
    }
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') spaceDown = false; });
  window.addEventListener('blur', () => { spaceDown = false; endDraw(); });
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(paper);
  else window.addEventListener('resize', resizeCanvas);
  resizeCanvas(); loadSaved();
})();
