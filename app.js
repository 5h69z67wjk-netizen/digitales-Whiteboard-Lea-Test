/* ==============================================================
   Grundkonfiguration
   ============================================================== */
const canvas = new fabric.Canvas('board', {
    isDrawingMode: false,   // wird per Button umgeschaltet
    selection: true
});

/* ---- Größe automatisch an den Browser anpassen ---- */
function resizeCanvas() {
    const toolbarHeight = document.getElementById('toolbar').offsetHeight;
    canvas.setHeight(window.innerHeight - toolbarHeight);
    canvas.setWidth(window.innerWidth);
    canvas.renderAll();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* --------------------------------------------------------------
   Berechtigungs‑Logik (read / partial / full)
   -------------------------------------------------------------- */
let currentPermission = 'partial'; // Standard

function updateUIForPermission() {
    const isReadOnly   = currentPermission === 'read';
    const isPartial    = currentPermission === 'partial';
    const isFull       = currentPermission === 'full';

    // Buttons, die nur bei Voll‑Bearbeitung funktionieren
    document.getElementById('drawBtn').disabled   = isReadOnly;
    document.getElementById('imageBtn').disabled  = !isFull;
    document.getElementById('noteBtn').disabled   = !isFull;
    document.getElementById('lockBtn').disabled   = !isFull;
    document.getElementById('textBtn').disabled   = isReadOnly; // Teil‑Bearbeitung erlaubt Text‑Edit

    // Freihand‑Modus nur bei Voll‑Bearbeitung
    canvas.isDrawingMode = false;
}
document.getElementById('permSelect').addEventListener('change', e => {
    currentPermission = e.target.value;
    updateUIForPermission();
});
updateUIForPermission(); // initiale Einstellung

/* --------------------------------------------------------------
   Toolbar‑Button‑Handler
   -------------------------------------------------------------- */

// ---- 1. Freihandzeichnen ----
document.getElementById('drawBtn').addEventListener('click', () => {
    if (currentPermission !== 'full') return;
    canvas.isDrawingMode = !canvas.isDrawingMode;
    // Visuelle Rückmeldung
    document.getElementById('drawBtn').style.fontWeight = canvas.isDrawingMode ? 'bold' : 'normal';
});

// ---- 2. Text einfügen (rich‑text‑Ansatz) ----
document.getElementById('textBtn').addEventListener('click', () => {
    if (currentPermission === 'read') return;

    // Box‑Objekt, das HTML‑Inhalt aufnehmen kann (fabric.Textbox)
    const textbox = new fabric.Textbox('Hier Text eingeben', {
        left: 100,
        top: 100,
        width: 200,
        fontSize: 16,
        backgroundColor: '#fff',
        editable: true,
        // Für Teil‑Bearbeitung erlauben wir nur das Bearbeiten
        // von Textcontent, nicht das Löschen/Zurücksetzen.
        lockMovementX: currentPermission === 'partial',
        lockMovementY: currentPermission === 'partial'
    });
    canvas.add(textbox).setActiveObject(textbox);
});

// ---- 3. Bild hochladen ----
const fileInput = document.getElementById('fileInput');
document.getElementById('imageBtn').addEventListener('click', () => {
    if (currentPermission !== 'full') return;
    fileInput.click(); // öffnet Dateiauswahl
});
fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (f) {
        fabric.Image.fromURL(f.target.result, img => {
            img.set({
                left: 150,
                top: 150,
                scaleX: 0.5,
                scaleY: 0.5,
                // Bilder können bei Teil‑Bearbeitung bewegt werden,
                // aber nicht gelöscht oder neu erstellt werden.
                lockScalingX: currentPermission === 'partial',
                lockScalingY: currentPermission === 'partial',
                lockRotation: currentPermission === 'partial'
            });
            canvas.add(img).setActiveObject(img);
        });
    };
    reader.readAsDataURL(file);
    // Reset, damit dieselbe Datei erneut gewählt werden kann
    e.target.value = '';
});

// ---- 4. Sticky‑Note (einfaches Rechteck mit Text) ----
document.getElementById('noteBtn').addEventListener('click', () => {
    if (currentPermission !== 'full') return;
    const rect = new fabric.Rect({
        width: 200,
        height: 150,
        fill: '#fff9b1',
        stroke: '#e0c800',
        strokeWidth: 1,
        left: 120,
        top: 120,
        rx: 5,
        ry: 5
    });
    const note = new fabric.Textbox('Sticky‑Note', {
        left: rect.left + 10,
        top: rect.top + 10,
        width: rect.width - 20,
        fontSize: 14,
        backgroundColor: 'transparent',
        editable: true
    });
    // Gruppe aus Rechteck + Text, damit beide zusammen bewegt werden
    const group = new fabric.Group([rect, note], {
        left: rect.left,
        top: rect.top
    });
    canvas.add(group).setActiveObject(group);
});

// ---- 5. Element sperren / entsperren ----
document.getElementById('lockBtn').addEventListener('click', () => {
    if (currentPermission !== 'full') return;
    const obj = canvas.getActiveObject();
    if (!obj) return;

    // Toggle der Sperr‑Eigenschaften
    const lock = !obj.lockMovementX; // wenn nicht gesperrt → sperren
    obj.set({
        lockMovementX: lock,
        lockMovementY: lock,
        lockScalingX: lock,
        lockScalingY: lock,
        lockRotation: lock,
        selectable: !lock   // gesperrte Objekte können nicht ausgewählt werden
    });
    canvas.renderAll();
    // Button‑Beschriftung anpassen
    document.getElementById('lockBtn').textContent = lock ? '🔓 Entsperren' : '🔒 Sperren';
});

/* --------------------------------------------------------------
   Hilfsfunktion: Objekt entfernen (nur bei Voll‑Bearbeitung)
   -------------------------------------------------------------- */
canvas.on('mouse:down', function (opt) {
    if (currentPermission !== 'full') return;
    const evt = opt.e;
    if (evt.altKey && opt.target) { // Alt+Click → Objekt löschen
        canvas.remove(opt.target);
    }
});

/* --------------------------------------------------------------
   Hinweis zu Rich‑Text‑Tabellen
   --------------------------------------------------------------
   Fabric.js unterstützt kein echtes HTML‑Rendering innerhalb von
   Canvas‑Objekten. Für ein vollständiges Rich‑Text‑Erlebnis (z.B.
   Tabellen) empfiehlt sich die Kombination mit einer ContentEditable‑
   Overlay‑Komponente (z. B. ein verstecktes <div>, das über das
   Canvas gelegt wird). In diesem Minimal‑MVP werden Tabellen als
   einfacher Text mit Tab‑Trennungen eingefügt. Der Code‑Abschnitt
   kann später durch eine Bibliothek wie **Tldraw** oder **Konva.js**
   erweitert werden.
   -------------------------------------------------------------- */
