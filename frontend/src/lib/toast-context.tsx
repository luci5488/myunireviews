'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { clsx } from 'clsx';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }
interface ToastContextValue { showToast: (message: string, type?: ToastType) => void; }

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white max-w-xs animate-fade-in-up',
              t.type === 'success' && 'bg-green-600',
              t.type === 'error'   && 'bg-red-600',
              t.type === 'info'    && 'bg-blue-600',
            )}
          >
            {t.type === 'success' && '✓ '}{t.type === 'error' && '✕ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
