import { fillFields } from './dom-fill';
import { scanPage } from './dom-scan';
import type { ContentMessage } from '../shared/messages';

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  if (message.type === 'SCAN_PAGE') {
    sendResponse({ fields: scanPage() });
    return false;
  }

  if (message.type === 'FILL_FIELDS') {
    sendResponse(fillFields(message.payload.instructions, message.payload.overwrite));
    return false;
  }

  return false;
});
