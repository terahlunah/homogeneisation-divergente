let recording = false;
let stopRequested = false;

/**
 * Record the simulation frame-by-frame with perfect timing.
 *
 * Uses WebCodecs VideoEncoder + webm-muxer for explicit frame timestamps.
 * Each frame is rendered by renderFrame(), encoded at exactly 1/60s intervals
 * regardless of real-time performance. No lag, no dropped frames.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {function} renderFrame - advance physics + render one frame
 * @param {function} onTick - called every 60 frames with elapsed seconds
 * @returns {Promise} resolves when stopped and file downloaded
 */
export async function startRecording(canvas, renderFrame, onTick = null) {
  const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/webm-muxer@5/+esm');

  recording = true;
  stopRequested = false;

  const width = canvas.width;
  const height = canvas.height;
  const FPS = 60;
  const frameDuration = 1_000_000 / FPS; // microseconds

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP9',
      width,
      height,
      frameRate: FPS,
    },
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e),
  });

  encoder.configure({
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate: 5_000_000,
    framerate: FPS,
  });

  let frameIndex = 0;

  function encodeFrame() {
    renderFrame();

    const videoFrame = new VideoFrame(canvas, {
      timestamp: frameIndex * frameDuration,
    });
    encoder.encode(videoFrame, { keyFrame: frameIndex % 60 === 0 });
    videoFrame.close();

    frameIndex++;
    if (frameIndex % FPS === 0 && onTick) {
      onTick(frameIndex / FPS);
    }
  }

  // Batch frames with yields to keep UI responsive
  return new Promise((resolve) => {
    function batch() {
      if (stopRequested) {
        finalize();
        return;
      }
      // Encode a few frames per tick, yield between batches
      const batchSize = 4;
      for (let i = 0; i < batchSize && !stopRequested; i++) {
        encodeFrame();
      }
      setTimeout(batch, 0);
    }

    async function finalize() {
      await encoder.flush();
      encoder.close();
      muxer.finalize();

      const blob = new Blob([target.buffer], { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'homogeneisation-divergente.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      recording = false;
      resolve();
    }

    batch();
  });
}

/**
 * Stop recording. Triggers finalization and download.
 */
export function stopRecording() {
  stopRequested = true;
}

/**
 * @returns {boolean} true if currently recording
 */
export function isRecording() {
  return recording;
}
