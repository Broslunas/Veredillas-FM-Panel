import { Mp3Encoder } from '@breezystack/lamejs';

function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

self.onmessage = (event) => {
  try {
    const { left, right, sampleRate, kbps } = event.data;
    const channels = right ? 2 : 1;
    const encoder = new Mp3Encoder(channels, sampleRate, kbps);

    const leftPCM = floatTo16BitPCM(left);
    const rightPCM = right ? floatTo16BitPCM(right) : null;

    const sampleBlockSize = 1152; // multiple of 576, expected by the encoder
    const chunks = [];
    const totalSamples = leftPCM.length;
    let lastProgressPostedAt = 0;

    for (let i = 0; i < totalSamples; i += sampleBlockSize) {
      const leftChunk = leftPCM.subarray(i, i + sampleBlockSize);
      const mp3buf = rightPCM
        ? encoder.encodeBuffer(leftChunk, rightPCM.subarray(i, i + sampleBlockSize))
        : encoder.encodeBuffer(leftChunk);
      if (mp3buf.length > 0) chunks.push(mp3buf);

      const now = Date.now();
      if (now - lastProgressPostedAt > 200) {
        lastProgressPostedAt = now;
        self.postMessage({ type: 'progress', progress: i / totalSamples });
      }
    }

    const finalChunk = encoder.flush();
    if (finalChunk.length > 0) chunks.push(finalChunk);

    self.postMessage({ type: 'done', chunks });
  } catch (error) {
    self.postMessage({ type: 'error', error: error && error.message ? error.message : String(error) });
  }
};
