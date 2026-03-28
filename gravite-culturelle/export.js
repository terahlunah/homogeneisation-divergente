let mediaRecorder = null;
let chunks = [];
let startTime = 0;
let onTickCallback = null;
let tickInterval = null;

/**
 * Start recording the canvas as WebM.
 * @param {HTMLCanvasElement} canvas
 * @param {function} onTick - called every second with elapsed seconds
 * @returns {MediaRecorder}
 */
export function startRecording(canvas, onTick = null) {
  chunks = [];
  onTickCallback = onTick;

  const stream = canvas.captureStream(60);

  // Prefer VP9 but fall back to VP8 or default
  let options = {};
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    options.mimeType = 'video/webm;codecs=vp9';
  } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    options.mimeType = 'video/webm;codecs=vp8';
  }
  options.videoBitsPerSecond = 5_000_000;

  mediaRecorder = new MediaRecorder(stream, options);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    clearInterval(tickInterval);
    tickInterval = null;

    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'homogeneisation-divergente.webm';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    chunks = [];
  };

  startTime = Date.now();
  mediaRecorder.start(1000);

  if (onTick) {
    tickInterval = setInterval(() => {
      onTick(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
  }

  return mediaRecorder;
}

/**
 * Stop recording. Triggers download automatically.
 */
export function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
}

/**
 * @returns {boolean} true if currently recording
 */
export function isRecording() {
  return mediaRecorder !== null && mediaRecorder.state === 'recording';
}
