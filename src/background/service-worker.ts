import { appendAuditEvent, getState, markValueUsed, saveMapping, saveProfileValue } from '../core/storage';
import type { BackgroundMessage } from '../shared/messages';

chrome.runtime.onInstalled.addListener(() => {
  void getState();
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATE': {
        sendResponse(await getState());
        return;
      }
      case 'SAVE_PROFILE_VALUE': {
        const state = await saveProfileValue(message.payload.fieldType as any, {
          value: message.payload.value,
          label: message.payload.label,
          pinned: message.payload.pinned
        });
        await appendAuditEvent({ type: 'save_value', details: { fieldType: message.payload.fieldType } });
        sendResponse(state);
        return;
      }
      case 'SAVE_MAPPING': {
        const state = await saveMapping(message.payload as any);
        await appendAuditEvent({ type: 'save_mapping', details: { mapping: message.payload } });
        sendResponse(state);
        return;
      }
      case 'MARK_VALUE_USED': {
        const state = await markValueUsed(message.payload.fieldType as any, message.payload.valueId);
        sendResponse(state);
        return;
      }
      case 'LOG_EVENT': {
        const state = await appendAuditEvent({
          type: message.payload.type as any,
          domain: message.payload.domain,
          details: message.payload.details
        });
        sendResponse(state);
        return;
      }
      default:
        sendResponse({ error: 'unknown message' });
    }
  })().catch((error) => {
    sendResponse({ error: error instanceof Error ? error.message : 'unknown error' });
  });

  return true;
});
