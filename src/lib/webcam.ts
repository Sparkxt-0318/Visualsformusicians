export type WebcamHandle = {
  stream: MediaStream;
  video: HTMLVideoElement;
  stop: () => void;
};

let active: WebcamHandle | null = null;

export async function startWebcam(
  constraints: MediaStreamConstraints = {
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  },
): Promise<WebcamHandle> {
  if (active) return active;

  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  // Hidden — never inserted into the DOM. The raw frame must never be visible.
  video.style.display = 'none';

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      video
        .play()
        .then(() => resolve())
        .catch(reject);
    };
    video.onerror = () => reject(new Error('webcam video element failed to load'));
  });

  active = {
    stream,
    video,
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      active = null;
    },
  };
  return active;
}

export function getWebcam(): WebcamHandle | null {
  return active;
}

export function stopWebcam() {
  active?.stop();
}
