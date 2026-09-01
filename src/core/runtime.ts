import type { RuntimeInfo, SupportedRuntime } from '../types/index.js';

interface RuntimeProcess {
  version?: string;
  versions?: {
    electron?: string;
    node?: string;
  };
}

const getRuntimeProcess = () =>
  (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;

export const detectRuntime = () => {
  const process = getRuntimeProcess();

  if (globalThis.navigator?.product === 'ReactNative') {
    return { type: 'react-native' };
  }

  if (process?.versions?.electron !== undefined) {
    return {
      type: 'electron',
      version: process.versions.electron
    };
  }

  if (process?.versions?.node !== undefined) {
    return {
      type: 'node',
      version: process.version ?? process.versions.node
    };
  }

  return { type: 'browser' };
};

export const getRuntimeType = () => detectRuntime().type;
