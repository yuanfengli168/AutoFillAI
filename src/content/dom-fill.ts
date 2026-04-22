import type { FillInstruction, FillResult, FillResultItem } from '../core/types';

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
}

function dispatchStandardEvents(element: HTMLElement) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function fillElement(element: HTMLElement, value: string) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    setNativeValue(element, value);
    dispatchStandardEvents(element);
    return;
  }

  if (element instanceof HTMLSelectElement) {
    element.value = value;
    dispatchStandardEvents(element);
    return;
  }

  throw new Error('unsupported element type');
}

export function fillFields(instructions: FillInstruction[], overwrite = false): FillResult {
  const results: FillResultItem[] = instructions.map((instruction) => {
    const element = document.querySelector<HTMLElement>(`[data-autofillai-id="${instruction.elementId}"]`);
    if (!element) {
      return { elementId: instruction.elementId, fieldType: instruction.fieldType, status: 'missing', reason: 'element not found' };
    }

    const currentValue =
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
        ? element.value
        : '';

    if (!overwrite && currentValue.trim()) {
      return { elementId: instruction.elementId, fieldType: instruction.fieldType, status: 'skipped', reason: 'field already has value' };
    }

    try {
      element.focus();
      fillElement(element, instruction.value);
      return { elementId: instruction.elementId, fieldType: instruction.fieldType, status: 'filled' };
    } catch (error) {
      return {
        elementId: instruction.elementId,
        fieldType: instruction.fieldType,
        status: 'error',
        reason: error instanceof Error ? error.message : 'unknown error'
      };
    }
  });

  return { results };
}
