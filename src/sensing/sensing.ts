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

  sense(video: HTMLVideoElement, t: number): SensedFrame {
    const poseRes = this.pose.detectForVideo(video, t);
    const faceRes = this.face.detectForVideo(video, t);

    const poseLandmarks: Landmark[] = (poseRes.landmarks[0] ?? []).map((l) => ({
      x: l.x, y: l.y, z: l.z, visibility: l.visibility,
    }));
    const faceBlendshapes: Blendshape[] = (faceRes.faceBlendshapes[0]?.categories ?? []).map((c) => ({
      name: c.categoryName, score: c.score,
    }));

    return { t, poseLandmarks, faceBlendshapes };
  }
}
