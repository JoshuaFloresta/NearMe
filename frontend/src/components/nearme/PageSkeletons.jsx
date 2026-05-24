import React from 'react';

export function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-bauhaus-canvas border-2 border-bauhaus-ink/20 ${className}`} />;
}

export function ProviderCardSkeletonList({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`provider-skeleton-${idx}`} className="border-4 border-bauhaus-ink bg-white p-4">
          <div className="flex items-start gap-3">
            <SkeletonBlock className="w-16 h-16 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-3 w-1/2" />
              <SkeletonBlock className="h-3 w-1/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConversationListSkeleton({ count = 6 }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`conversation-skeleton-${idx}`} className="px-4 py-4 border-b-2 border-bauhaus-ink/10">
          <div className="flex items-start gap-3">
            <SkeletonBlock className="w-10 h-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-1/2" />
              <SkeletonBlock className="h-3 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaymentPortalSkeleton() {
  return (
    <div className="space-y-5">
      <div className="border-4 border-bauhaus-ink bg-white p-5 space-y-3">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="h-3 w-48" />
        <SkeletonBlock className="h-8 w-36" />
      </div>
      <div className="border-4 border-bauhaus-ink bg-white p-5 space-y-3">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </div>
  );
}
