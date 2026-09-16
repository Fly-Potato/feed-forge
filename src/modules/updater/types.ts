export interface UpdateProgress {
  downloaded: number;
  total?: number;
}

export interface AvailableUpdate {
  version: string;
  notes: string;
  install: (onProgress: (progress: UpdateProgress) => void) => Promise<void>;
}
