import React from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ rating, size = 'sm', showNumber = true }) {
  const stars = [1, 2, 3, 4, 5];
  const h = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-1">
      {stars.map((s) => (
        <Star key={s} className={`${h} ${s <= Math.round(rating) ? 'text-bauhaus-yellow fill-bauhaus-yellow' : 'text-bauhaus-ink/20 fill-bauhaus-ink/10'}`} />
      ))}
      {showNumber && (
        <span className={`font-black ${size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'} text-bauhaus-ink ml-0.5`}>{rating}</span>
      )}
    </div>
  );
}