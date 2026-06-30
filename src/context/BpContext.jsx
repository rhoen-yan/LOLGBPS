import { createContext, useContext } from 'react';

export const BpContext = createContext(null);

export function useBp() {
  const ctx = useContext(BpContext);
  if (!ctx) throw new Error('useBp must be used within BpProvider');
  return ctx;
}
