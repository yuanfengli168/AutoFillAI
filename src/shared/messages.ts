import type { FillInstruction, FillResult, PinnedScan } from '../core/types';

export type ContentMessage =
  | { type: 'SCAN_PAGE' }
  | { type: 'FILL_FIELDS'; payload: { instructions: FillInstruction[]; overwrite?: boolean } };

export type BackgroundMessage =
  | { type: 'GET_STATE' }
  | { type: 'SAVE_PROFILE_VALUE'; payload: { fieldType: string; value: string; label?: string; pinned?: boolean } }
  | { type: 'SAVE_MAPPING'; payload: Record<string, unknown> }
  | { type: 'MARK_VALUE_USED'; payload: { fieldType: string; valueId?: string } }
  | { type: 'LOG_EVENT'; payload: { type: string; domain?: string; details?: Record<string, unknown> } }
  | { type: 'UPDATE_SETTINGS'; payload: Record<string, unknown> }
  | { type: 'ENSURE_FIELD_TYPE'; payload: { fieldType: string } }
  | { type: 'SAVE_PINNED_SCAN'; payload: PinnedScan }
  | { type: 'CLEAR_PINNED_SCAN'; payload: { tabId: number } };

export interface ScanPageResponse {
  fields: unknown[];
}

export interface FillFieldsResponse extends FillResult {}
