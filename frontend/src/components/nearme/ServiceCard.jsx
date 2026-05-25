import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, CheckCircle, Clock } from 'lucide-react';

const cornerColors = ['bg-bauhaus-red', 'bg-bauhaus-blue', 'bg-bauhaus-yellow'];

const providerPathId = (provider) => provider.id || provider._id;

export default function ServiceCard({ provider, compact = false }) {
  const color = cornerColors[Number(provider.id || 0) % 3];
  const name = provider.name || 'Provider';
  const distanceLabel = Number.isFinite(Number(provider.distance)) ? `${provider.distance} km` : 'Nearby';
  const visibleRate = Number(provider.startingRate ?? provider.rate ?? 0);

  return (
    <Link
      to={`/provider/${providerPathId(provider)}`}
      className="block bg-white border-2 md:border-4 border-bauhaus-ink shadow-bauhaus-sm md:shadow-bauhaus-lg transition-all duration-200 hover:-translate-y-1 group"
    >
      <div className={compact ? 'p-3 md:p-4' : 'p-5 md:p-6'}>
        <div className={`${compact ? 'mb-2.5' : 'mb-4'} flex items-center justify-between gap-3`}>
          <div className={`inline-flex max-w-full items-center gap-1 px-2 py-1 border border-bauhaus-ink text-[10px] font-bold uppercase tracking-wider ${provider.available ? 'bg-bauhaus-yellow text-bauhaus-ink' : 'bg-white/80 text-bauhaus-ink/50'}`}>
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{provider.available ? 'Available' : 'Busy'}</span>
          </div>
          <div className={`h-3 w-3 shrink-0 ${color}`} />
        </div>

        <div className={`flex items-start ${compact ? 'gap-3' : 'gap-4'}`}>
          <div className="relative shrink-0">
            {provider.avatar ? (
              <img src={provider.avatar} alt={name} className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} object-cover border-2 border-bauhaus-ink grayscale group-hover:grayscale-0 transition-all duration-300`} />
            ) : (
              <div className={`${compact ? 'w-12 h-12 text-xs' : 'w-16 h-16 text-sm'} border-2 border-bauhaus-ink bg-bauhaus-yellow flex items-center justify-center font-black uppercase`}>
                {name.slice(0, 2)}
              </div>
            )}
            {provider.verified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-bauhaus-blue rounded-full border-2 border-white flex items-center justify-center">
                <CheckCircle className="h-3 w-3 text-white" strokeWidth={3} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-black ${compact ? 'text-xs' : 'text-sm'} uppercase tracking-tight text-bauhaus-ink truncate`}>{name}</div>
            <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-red mt-0.5">{provider.service || 'General Service'}</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <Star className="h-3 w-3 text-bauhaus-yellow fill-bauhaus-yellow shrink-0" />
              <span className="font-black text-xs text-bauhaus-ink">{provider.rating || '0.0'}</span>
              <span className="text-bauhaus-ink/30 text-xs">-</span>
              <span className="font-medium text-xs text-bauhaus-ink/50">{provider.reviews || 0} reviews</span>
            </div>
          </div>
        </div>

        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${compact ? 'mt-3 pt-3' : 'mt-4 pt-4'} border-t-2 border-bauhaus-ink/10`}>
          <div className="flex min-w-0 items-center gap-1 text-bauhaus-ink/50">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium text-xs">{distanceLabel} - {provider.location || 'Location not set'}</span>
          </div>
          <div className={`shrink-0 font-black ${compact ? 'text-xs' : 'text-sm'} text-bauhaus-ink`}>PHP {visibleRate.toLocaleString('en-PH')}<span className="font-medium text-xs text-bauhaus-ink/40"> start</span></div>
        </div>

        <div className={`flex flex-wrap gap-1 ${compact ? 'mt-2' : 'mt-3'}`}>
          {(provider.tags || []).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-bauhaus-canvas border border-bauhaus-ink/20 font-medium text-[10px] uppercase tracking-wider text-bauhaus-ink/60">{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}
