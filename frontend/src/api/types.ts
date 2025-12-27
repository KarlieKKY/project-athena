export const StemType = {
  VOCALS: "vocals",
  DRUMS: "drums",
  BASS: "bass",
  OTHER: "other",
} as const;

export type StemType = typeof StemType[keyof typeof StemType];

export interface AudioSeparationRequest {
  file_path: string;
  two_stems?: string | null;
  mp3: boolean;
  mp3_rate: number;
  float32: boolean;
  int24: boolean;
}

export interface AudioSeparationResult {
  stems: string[];
  message: string;
}

export interface AudioResponse {
  success: boolean;
  message: string;
  data?: {
    task_id: string;
    original_filename: string;
    stems: string[];
  };
}

export interface SeparationStatus {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  result?: AudioSeparationResult;
  error?: string;
}

export interface DeviceInfo {
  cuda_available: boolean;
  device_name?: string;
  pytorch_version: string;
  cuda_version?: string;
}
