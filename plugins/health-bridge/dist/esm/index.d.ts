export type HealthSymptomKind = "hotFlashes" | "nightSweats";
export interface HealthBridgePlugin {
  /** HealthKit present on this device (false on iPad/web). */
  isAvailable(): Promise<{ available: boolean }>;
  /** Ask for write access to the hot flashes and night sweats categories. Resolves granted=false when the user declines all. */
  requestAuthorization(): Promise<{ granted: boolean }>;
  /** Write one symptom sample; severity 0 unspecified, 2 mild, 3 moderate, 4 severe. Returns the sample uuid. */
  writeSymptom(options: { kind: HealthSymptomKind; start: string; end: string; severity: number; replaceUuid?: string | null }): Promise<{ uuid: string }>;
  /** Delete a sample this app wrote. */
  deleteSample(options: { uuid: string; kind: HealthSymptomKind }): Promise<void>;
}
export declare const HealthBridge: HealthBridgePlugin;
