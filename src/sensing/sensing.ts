import { FilesetResolver, PoseLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';
import type { SensedFrame, Landmark, Blendshape } from '../types';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class Sensing {
  private pose!: PoseLandmarker;
  private face!: FaceLandmarker;
  private lastTs = 0;

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM);
    this.pose = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    this.face = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: true,
      numFaces: 1,
    });
  }

  /** True once both landmarkers are loaded and sense() will actually run inference. */
  isReady(): boolean {
    return !!this.pose && !!this.face;
  }

  sense(video: HTMLVideoElement, t: number): SensedFrame {
    // Models may not be loaded yet (or failed to load) — return an empty frame
    // instead of throwing, so the render loop doesn't spin on errors.
    if (!this.pose || !this.face) {
      return { t, poseLandmarks: [], faceBlendshapes: [] };
    }
    // MediaPipe requires monotonically increasing timestamps for the whole
    // session. The logical frame time `t` resets to 0 when recording starts, so
    // feeding it to MediaPipe would jump backwards and throw. Use an independent
    // ever-increasing clock for inference; keep `t` only for the music timeline.
    const ts = Math.max(Math.round(performance.now()), this.lastTs + 1);
    this.lastTs = ts;
    const poseRes = this.pose.detectForVideo(video, ts);
    const faceRes = this.face.detectForVideo(video, ts);

    const poseLandmarks: Landmark[] = (poseRes.landmarks[0] ?? []).map((l) => ({
      x: l.x, y: l.y, z: l.z, visibility: l.visibility,
    }));
    const faceBlendshapes: Blendshape[] = (faceRes.faceBlendshapes[0]?.categories ?? []).map((c) => ({
      name: c.categoryName, score: c.score,
    }));

    return { t, poseLandmarks, faceBlendshapes };
  }
}
