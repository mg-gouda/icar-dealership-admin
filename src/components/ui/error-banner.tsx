'use client';

interface ErrorBannerProps {
  error: unknown;
  retry?: () => void;
}

export function ErrorBanner({ error, retry }: ErrorBannerProps) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string' && error
      ? error
      : 'Something went wrong. Please try again.';

  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200 flex items-center justify-between gap-4">
      <span>{message}</span>
      {retry && (
        <button
          onClick={retry}
          className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
