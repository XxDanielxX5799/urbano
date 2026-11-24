const $ = id => document.getElementById(id);
let stream = null;
let evidencia = null;
let preview = null;
let versionCamara = 0;
const urls = [];
const db = new Promise((resolve, reject) => {
    const req = indexedDB.open('AlertaUrbana', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('reportes', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});
function mensaje(texto) { $('mensaje').textContent = texto; }
async function operar(modo, accion) {
    const base = await db;
    return new Promise((resolve, reject) => {
        const tx = base.transaction('reportes', modo);
        const req = accion(tx.objectStore('reportes'));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = tx.onabort = () => reject(tx.error);
    });
}
function conexion() {
    const online = navigator.onLine;
    $('conexion').textContent = online ? 'Con conexión (red disponible)' : 'Sin conexión (puedes guardar reportes)';
    $('conexion').classList.toggle('offline', !online);
    $('enviar').disabled = !online;
}
window.addEventListener('online', conexion);
window.addEventListener('offline', conexion);
conexion();
function cerrarCamara() {
    versionCamara++;
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    $('video').srcObject = null;
    $('video').hidden = $('capturar').hidden = $('cerrar').hidden = true;
    $('abrir').hidden = false;
}
$('abrir').onclick = async () => {
    cerrarCamara();
    const version = versionCamara;
    try {
        const nueva = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (version !== versionCamara) { nueva.getTracks().forEach(t => t.stop()); return; }
        stream = nueva;
        $('video').srcObject = stream;
        $('video').hidden = $('capturar').hidden = $('cerrar').hidden = false;
        $('abrir').hidden = $('foto').hidden = true;
    } catch (error) { mensaje('No se pudo abrir la cámara. Revisa los permisos y usa HTTPS o localhost.'); }
};
$('cerrar').onclick = () => { cerrarCamara(); $('foto').hidden = !evidencia; };
$('capturar').onclick = async () => {
    const video = $('video');
    if (!video.videoWidth) return mensaje('Espera a que inicie la cámara.');
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1280, video.videoWidth);
    canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .8));
    if (!blob) return mensaje('No se pudo capturar la foto.');
    evidencia = blob;
    if (preview) URL.revokeObjectURL(preview);
    preview = URL.createObjectURL(blob);
    $('foto').src = preview;
    $('foto').hidden = false;
    cerrarCamara();
    $('abrir').textContent = 'Repetir fotografía';
    mensaje('Fotografía capturada.');
};
$('formulario').onsubmit = async e => {
    e.preventDefault();
    if (!$('direccion').value.trim()) return mensaje('Escribe la dirección.');
    if (!evidencia) return mensaje('Toma una fotografía antes de guardar.');
    const boton = e.submitter;
    boton.disabled = true;
    try {
        await operar('readwrite', s => s.add({ direccion: $('direccion').value.trim(), tipo: $('tipo').value, descripcion: $('descripcion').value.trim(), foto: evidencia, fecha: new Date().toISOString(), estado: 'pendiente' }));
        cerrarCamara();
        evidencia = null;
        if (preview) URL.revokeObjectURL(preview);
        preview = null;
        $('foto').removeAttribute('src');
        $('foto').hidden = true;
        $('abrir').textContent = 'Encender cámara';
        $('formulario').reset();
        mensaje('Reporte guardado en el dispositivo.');
        await mostrar();
    } catch { mensaje('No se pudo guardar el reporte. Revisa el almacenamiento.'); }
    finally { boton.disabled = false; }
};
async function mostrar() {
    const lista = await operar('readonly', s => s.getAll());
    urls.splice(0).forEach(url => URL.revokeObjectURL(url));
    $('reportes').replaceChildren();
    if (!lista.length) $('reportes').textContent = 'Todavía no hay reportes.';
    for (const r of lista.reverse()) {
        const tarjeta = document.createElement('article');
        tarjeta.className = 'reporte';
        const titulo = document.createElement('h3');
        titulo.textContent = r.tipo;
        const estado = document.createElement('span');
        estado.className = 'estado' + (r.estado === 'simulado' ? ' enviado' : '');
        estado.textContent = r.estado === 'simulado' ? 'Enviado (simulación)' : 'En espera';
        tarjeta.append(titulo, estado);
        for (const texto of [r.direccion, new Date(r.fecha).toLocaleString('es-MX'), r.descripcion]) {
            const p = document.createElement('p'); p.textContent = texto; tarjeta.append(p);
        }
        const img = document.createElement('img');
        img.src = URL.createObjectURL(r.foto); urls.push(img.src);
        img.alt = 'Evidencia del reporte'; tarjeta.append(img);
        $('reportes').append(tarjeta);
    }
}
$('enviar').onclick = async () => {
    if (!navigator.onLine) return mensaje('Sin conexión. Los reportes siguen guardados.');
    $('enviar').disabled = true;
    try {
        const lista = await operar('readonly', s => s.getAll());
        let total = 0;
        for (const r of lista.filter(r => r.estado === 'pendiente')) {
            if (!navigator.onLine) break;
            await operar('readwrite', s => s.put({ ...r, estado: 'simulado' }));
            total++;
        }
        await mostrar();
        mensaje(`${total} reporte(s) con envío simulado. No se enviaron datos al gobierno.`);
    } catch { mensaje('Error al actualizar los reportes.'); }
    finally { conexion(); }
};
window.addEventListener('pagehide', cerrarCamara);
mostrar().catch(() => mensaje('No se pudo abrir el almacenamiento local.'));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => mensaje('No se pudo activar el modo sin conexión.'));
