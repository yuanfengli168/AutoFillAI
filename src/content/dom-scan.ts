import { classifyField } from '../core/field-classifier';
import type { DetectedField, FieldSignature } from '../core/types';
import { uniqueStrings } from '../core/utils';

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function getLabelText(element: HTMLElement): string | undefined {
  const id = element.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  const parentLabel = element.closest('label');
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  return undefined;
}

function getNearbyText(element: HTMLElement): string[] {
  const parent = element.parentElement;
  if (!parent) return [];

  const texts = Array.from(parent.querySelectorAll('span, div, p, small, strong, legend'))
    .map((node) => node.textContent?.trim())
    .filter((value): value is string => !!value && value.length > 0)
    .slice(0, 6);

  return uniqueStrings(texts).slice(0, 4);
}

function ensureElementId(element: HTMLElement, index: number) {
  if (!element.dataset.autofillaiId) {
    element.dataset.autofillaiId = `afi_${index}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return element.dataset.autofillaiId;
}

function getCurrentValue(element: HTMLElement) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value;
  }
  return element.textContent ?? '';
}

function getOptions(element: HTMLElement) {
  if (!(element instanceof HTMLSelectElement)) return undefined;
  return Array.from(element.options)
    .map((option) => option.textContent?.trim())
    .filter((value): value is string => !!value && value.length > 0);
}

function buildSignature(element: HTMLElement): FieldSignature {
  return {
    tagName: element.tagName.toLowerCase(),
    inputType: element instanceof HTMLInputElement ? element.type : undefined,
    name: element.getAttribute('name') ?? undefined,
    id: element.getAttribute('id') ?? undefined,
    label: getLabelText(element),
    placeholder: element.getAttribute('placeholder') ?? undefined,
    autocomplete: element.getAttribute('autocomplete') ?? undefined,
    ariaLabel: element.getAttribute('aria-label') ?? undefined,
    nearbyText: getNearbyText(element),
    domain: window.location.hostname,
    path: window.location.pathname
  };
}

export function scanPage(): DetectedField[] {
  const selector = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])',
    'textarea',
    'select'
  ].join(',');

  return Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element, index) => {
    const signature = buildSignature(element);
    return {
      elementId: ensureElementId(element, index),
      signature,
      candidateFieldTypes: classifyField(signature),
      currentValue: getCurrentValue(element),
      visible: isVisible(element),
      disabled: (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled ?? false,
      options: getOptions(element)
    } satisfies DetectedField;
  });
}
