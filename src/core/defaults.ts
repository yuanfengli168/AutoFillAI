import type { AppState } from './types';
import { nowIso, uid } from './utils';

const ts = nowIso();

export const DEFAULT_STATE: AppState = {
  profileValues: {
    full_name: [
      {
        id: uid('full_name'),
        value: 'Jacky Li',
        label: 'default',
        pinned: true,
        active: true,
        useCount: 0,
        createdAt: ts,
        updatedAt: ts,
        source: 'manual'
      }
    ],
    first_name: [
      {
        id: uid('first_name'),
        value: 'Jacky',
        label: 'default',
        pinned: true,
        active: true,
        useCount: 0,
        createdAt: ts,
        updatedAt: ts,
        source: 'manual'
      }
    ],
    last_name: [
      {
        id: uid('last_name'),
        value: 'Li',
        label: 'default',
        pinned: true,
        active: true,
        useCount: 0,
        createdAt: ts,
        updatedAt: ts,
        source: 'manual'
      }
    ],
    linkedin_url: [
      {
        id: uid('linkedin_url'),
        value: 'https://www.linkedin.com/in/yuanfengli99/',
        label: 'profile',
        pinned: true,
        active: true,
        useCount: 0,
        createdAt: ts,
        updatedAt: ts,
        source: 'manual'
      }
    ]
  },
  mappings: [],
  settings: {
    autoFillThreshold: 0.82,
    suggestThreshold: 0.55,
    rememberCorrections: true
  },
  auditLog: []
};
