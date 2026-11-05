/* ============================================================
   Shared file-attachment utility for the AI Tools pages
   (AI Quiz Maker, AI Flashcard Maker, AI Study Assistant).

   One reusable module instead of duplicating file validation /
   base64 conversion / "selected file" UI on every page. Classic
   script (same pattern as core/layout.js, utils/dom.js) so plain
   <script>-tag pages can call it inline.

   Files are NEVER persisted anywhere by this module — they are
   only held in memory (as a base64 string) long enough to be sent
   straight to the Supabase Edge Function by ai-client.js. ============================================================ */

const AI_UPLOAD_MAX_BYTES = 8 * 1024 * 1024; /* 8 MB — matches the backend's limit */
const AI_UPLOAD_ACCEPTED_TYPES = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG',
    'image/png': 'PNG',
};

function aiUploadFormatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* Validates a File object against the shared rules. Returns { ok: true } or
   { ok: false, message }. Never throws. */
function aiUploadValidateFile(file) {
    if (!file) return { ok: false, message: 'No file was selected.' };
    if (file.size === 0) return { ok: false, message: 'That file is empty.' };
    if (file.size > AI_UPLOAD_MAX_BYTES)
        return { ok: false, message: `That file is too large. Attachments must be 8 MB or smaller (yours is ${aiUploadFormatSize(file.size)}).` };
    if (!AI_UPLOAD_ACCEPTED_TYPES[file.type])
        return { ok: false, message: 'Unsupported file type. Please attach a PDF, JPG, or PNG file.' };
    return { ok: true };
}

/* Reads a File as a base64 string (no data: URI prefix), preserving MIME type
   and filename. Resolves { base64, mimeType, fileName, fileSize } or rejects
   with a plain Error for unreadable/corrupt files. */
function aiUploadToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const result = String(reader.result || '');
                const commaIndex = result.indexOf(',');
                const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
                if (!base64) {
                    reject(new Error('That file could not be read.'));
                    return;
                }
                resolve({ base64, mimeType: file.type, fileName: file.name, fileSize: file.size });
            } catch (error) {
                reject(new Error('That file could not be read.'));
            }
        };
        reader.onerror = () => reject(new Error('That file could not be read. It may be corrupted or unreadable.'));
        reader.onabort = () => reject(new Error('File reading was interrupted.'));
        reader.readAsDataURL(file);
    });
}

/**
 * Wires up a complete "attach a file" control: hidden <input type="file">,
 * a trigger button, a "selected file" info row (name + size), and a remove
 * button. Keeps the currently-attached file in memory only.
 *
 * opts:
 *   inputEl     - the <input type="file"> element
 *   triggerEl   - optional element that opens the file picker when clicked
 *   infoEl      - element to show "filename.pdf · 1.2 MB" in
 *   removeEl    - element that clears the current attachment
 *   emptyEl     - optional element to toggle visible when nothing is attached
 *   onError     - called with a message string when validation fails
 *   onChange    - called with the File (or null when cleared)
 *
 * Returns an object: { getFile(), clear() }
 */
function initAiFileAttachment(opts) {
    const { inputEl, triggerEl, infoEl, removeEl, emptyEl, onError, onChange } = opts;
    let currentFile = null;

    function renderState() {
        if (infoEl) {
            if (currentFile) {
                infoEl.hidden = false;
                infoEl.innerHTML = `<i class="bi ${currentFile.type === 'application/pdf' ? 'bi-file-earmark-pdf-fill' : 'bi-file-earmark-image-fill'}" aria-hidden="true"></i>
                    <span class="ai-file-name">${escHtml(currentFile.name)}</span>
                    <span class="ai-file-size">${aiUploadFormatSize(currentFile.size)}</span>`;
            } else {
                infoEl.hidden = true;
                infoEl.innerHTML = '';
            }
        }
        if (emptyEl) emptyEl.hidden = !!currentFile;
        if (removeEl) removeEl.hidden = !currentFile;
    }

    function setFile(file) {
        const validation = aiUploadValidateFile(file);
        if (!validation.ok) {
            if (onError) onError(validation.message);
            if (inputEl) inputEl.value = '';
            return;
        }
        currentFile = file;
        renderState();
        if (onChange) onChange(currentFile);
    }

    function clear() {
        currentFile = null;
        if (inputEl) inputEl.value = '';
        renderState();
        if (onChange) onChange(null);
    }

    if (inputEl) {
        inputEl.addEventListener('change', () => {
            const file = inputEl.files && inputEl.files[0];
            if (file) setFile(file);
        });
    }
    if (triggerEl && inputEl) {
        triggerEl.addEventListener('click', () => inputEl.click());
    }
    if (removeEl) {
        removeEl.addEventListener('click', clear);
    }

    renderState();
    return { getFile: () => currentFile, clear };
}

window.AI_UPLOAD_ACCEPTED_TYPES = AI_UPLOAD_ACCEPTED_TYPES;
window.aiUploadValidateFile = aiUploadValidateFile;
window.aiUploadToBase64 = aiUploadToBase64;
window.aiUploadFormatSize = aiUploadFormatSize;
window.initAiFileAttachment = initAiFileAttachment;
