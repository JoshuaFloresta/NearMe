import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import { Search, MapPin, Star, SlidersHorizontal, X, List, Navigation, ChevronDown } from 'lucide-react';
import NearMeNav from '../components/nearme/NearMeNav';
import ServiceCard from '../components/nearme/ServiceCard';
import { ProviderCardSkeletonList } from '../components/nearme/PageSkeletons';
import { apiRequest } from '../lib/api';

const DEFAULT_LOCATION = { lat: 14.5995, lng: 120.9842 };

const providerKey = (provider) => provider?.id || provider?._id || provider?.email || provider?.name || 'provider';

const providerPathId = (provider) => provider.id || provider._id;
const providerVisibleRate = (provider) => Number(provider?.startingRate ?? provider?.rate ?? 0);

const hasCoordinates = (provider) => (
  Number.isFinite(Number(provider?.coordinates?.lat)) && Number.isFinite(Number(provider?.coordinates?.lng))
);

function getDistanceKm(from, to) {
  if (!from || !to) return null;
  const earthRadiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function RecenterMap({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], 12, { animate: true });
  }, [center, map]);

  return null;
}

function ProviderMap({ providers, selected, onSelect, userLocation, radiusKm }) {
  const mappableProviders = providers.filter(hasCoordinates);

  return (
    <div className="h-full w-full overflow-hidden border-4 border-bauhaus-ink bg-white">
      <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={12} scrollWheelZoom className="h-full w-full">
        <RecenterMap center={userLocation} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={[userLocation.lat, userLocation.lng]}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#1040C0', fillColor: '#1040C0', fillOpacity: 0.08, weight: 2 }}
        />
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={9}
          pathOptions={{ color: '#ffffff', fillColor: '#1040C0', fillOpacity: 1, weight: 4 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
        {mappableProviders.map((provider) => (
          <CircleMarker
            key={providerKey(provider)}
            center={[Number(provider.coordinates.lat), Number(provider.coordinates.lng)]}
            radius={providerKey(selected) === providerKey(provider) ? 12 : 9}
            eventHandlers={{ click: () => onSelect(provider) }}
            pathOptions={{
              color: '#121212',
              fillColor: provider.available ? '#F0C020' : '#D02020',
              fillOpacity: 1,
              weight: providerKey(selected) === providerKey(provider) ? 4 : 2,
            }}
          >
            <Popup>
              <div className="min-w-[160px]">
                <div className="font-bold">{provider.name}</div>
                <div>{provider.service}</div>
                <div>{provider.distance} km away</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default function NearMeBrowse() {
  const [search, setSearch] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [minRate, setMinRate] = useState(100);
  const [maxRate, setMaxRate] = useState(1000);
  const [minRating, setMinRating] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [viewMode, setViewMode] = useState('split');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [radiusKm, setRadiusKm] = useState(10);
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);
  const [locationStatus, setLocationStatus] = useState('Detecting your location...');
  const [providers, setProviders] = useState([]);
  const [services, setServices] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryOptions = useMemo(
    () => (Array.isArray(services) ? services.map((service) => ({ value: String(service.id), label: service.label || service.name || service.id })) : []),
    [services]
  );

  useEffect(() => {
    Promise.all([
      apiRequest('/api/providers').catch(() => []),
      apiRequest('/api/services').catch(() => []),
    ])
      .then(([providerData, serviceData]) => {
        setProviders(Array.isArray(providerData) ? providerData : []);
        setServices(Array.isArray(serviceData) ? serviceData : []);
      })
      .finally(() => setLoadingProviders(false));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not supported by this browser. Showing default Manila proximity.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus('Showing providers near your current location.');
      },
      () => {
        setLocationStatus('Location access was not allowed. Showing default Manila proximity.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const filtered = useMemo(() => {
    return providers.map((provider) => {
      const distanceFromUser = getDistanceKm(userLocation, provider.coordinates);
      return {
        ...provider,
        distance: distanceFromUser == null ? Number(provider.distance || 0) : Number(distanceFromUser.toFixed(1)),
      };
    }).filter((provider) => {
      const providerName = String(provider.name || '').toLowerCase();
      const serviceName = String(provider.service || '').toLowerCase();
      const explicitMock = Boolean(provider.isMock || provider.mock || provider.isDemo);
      const implicitMock = providerName.includes('mock') || providerName.includes('demo') || serviceName.includes('mock') || serviceName.includes('demo');
      if (explicitMock || implicitMock) return false;
      const name = provider.name || '';
      const service = provider.service || '';
      const visibleRate = providerVisibleRate(provider);
      if (search && !name.toLowerCase().includes(search.toLowerCase()) && !service.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(String(provider.serviceId || ''))) return false;
      if (visibleRate < minRate) return false;
      if (visibleRate > maxRate) return false;
      if (Number(provider.rating || 0) < minRating) return false;
      if (availableOnly && !provider.available) return false;
      if (hasCoordinates(provider) && provider.distance > radiusKm) return false;
      return true;
    }).sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0));
  }, [providers, search, selectedCategories, minRate, maxRate, minRating, availableOnly, radiusKm, userLocation]);

  const resetFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setMinRate(100);
    setMaxRate(1000);
    setMinRating(0);
    setAvailableOnly(false);
    setRadiusKm(10);
  };

  return (
    <div className="min-h-screen bg-bauhaus-canvas font-outfit flex flex-col">
      <NearMeNav />

      <div className="bg-white border-b-4 border-bauhaus-ink py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center border-2 border-bauhaus-ink bg-bauhaus-canvas px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-bauhaus-ink/40 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services or providers..."
              className="flex-1 bg-transparent outline-none font-medium text-sm text-bauhaus-ink placeholder:text-bauhaus-ink/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 border-2 border-bauhaus-ink font-bold text-xs uppercase tracking-wider transition-all duration-200 ${showFilters ? 'bg-bauhaus-red text-white' : 'bg-white text-bauhaus-ink hover:bg-bauhaus-canvas'}`}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <div className="hidden sm:flex border-2 border-bauhaus-ink">
              {[
                { mode: 'split', label: 'Split', icon: SlidersHorizontal },
                { mode: 'list', label: 'List', icon: List },
                { mode: 'map', label: 'Map', icon: MapPin },
              ].map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-2 font-bold text-xs uppercase tracking-wider transition-colors duration-200 flex items-center gap-1 ${viewMode === mode ? 'bg-bauhaus-ink text-white' : 'bg-white text-bauhaus-ink hover:bg-bauhaus-canvas'}`}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t-2 border-bauhaus-ink/20">
            <div className="flex flex-wrap gap-6 items-end">
              <div className="min-w-[220px]">
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Categories</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCategoryMenuOpen((current) => !current)}
                    className="w-full min-h-[42px] border-2 border-bauhaus-ink bg-white px-2 py-1 flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      {selectedCategories.length === 0 && (
                        <span className="font-bold text-[11px] uppercase tracking-wider text-bauhaus-ink/40">Select categories</span>
                      )}
                      {selectedCategories.map((value) => {
                        const label = categoryOptions.find((item) => item.value === value)?.label || value;
                        return (
                          <span key={value} className="inline-flex items-center gap-1 px-2 py-0.5 bg-bauhaus-canvas border border-bauhaus-ink font-black text-[10px] uppercase tracking-wider text-bauhaus-ink">
                            {label}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedCategories((current) => current.filter((item) => item !== value));
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedCategories((current) => current.filter((item) => item !== value));
                                }
                              }}
                              className="text-bauhaus-ink/50 hover:text-bauhaus-red"
                            >
                              ×
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <ChevronDown className="h-4 w-4 text-bauhaus-ink/60 shrink-0" />
                  </button>

                  {categoryMenuOpen && (
                    <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto border-2 border-bauhaus-ink bg-white p-2 space-y-1 shadow-bauhaus-sm">
                      {categoryOptions.length === 0 && (
                        <div className="font-bold text-[11px] uppercase tracking-wider text-bauhaus-ink/40">No categories found</div>
                      )}
                      {categoryOptions.map((category) => (
                        <label key={category.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category.value)}
                            onChange={(e) => {
                              setSelectedCategories((current) => (
                                e.target.checked
                                  ? [...new Set([...current, category.value])]
                                  : current.filter((item) => item !== category.value)
                              ));
                            }}
                            className="w-4 h-4 accent-bauhaus-blue"
                          />
                          <span className="font-bold text-[11px] uppercase tracking-wider text-bauhaus-ink">{category.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Min Starting Price: ₱{minRate}</label>
                <input
                  type="range" min={100} max={2000} step={50} value={minRate}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setMinRate(next);
                    if (next > maxRate) setMaxRate(next);
                  }}
                  className="w-36 accent-bauhaus-blue"
                />
              </div>
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Max Starting Price: ₱{maxRate}</label>
                <input
                  type="range" min={100} max={2000} step={50} value={maxRate}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setMaxRate(next);
                    if (next < minRate) setMinRate(next);
                  }}
                  className="w-36 accent-bauhaus-red"
                />
              </div>
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Min Rating: {minRating}★</label>
                <input
                  type="range" min={0} max={5} step={0.5} value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                  className="w-36 accent-bauhaus-yellow"
                />
              </div>
              <div>
                <label className="font-bold text-[10px] uppercase tracking-widest text-bauhaus-ink/50 block mb-1">Proximity: {radiusKm} km</label>
                <input
                  type="range" min={1} max={25} step={1} value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-36 accent-bauhaus-blue"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  className="w-4 h-4 accent-bauhaus-blue"
                />
                <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink">Available Now Only</span>
              </label>
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-bauhaus-red hover:underline"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-bold text-xs uppercase tracking-wider text-bauhaus-ink/50">
            {filtered.length} provider{filtered.length !== 1 ? 's' : ''} found within {radiusKm} km
          </span>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-bauhaus-ink/40">
            <Navigation className="h-3 w-3 shrink-0" />
            <span className="truncate">{locationStatus}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:hidden">
          {[
            { mode: 'list', icon: List },
            { mode: 'map', icon: MapPin },
          ].map(({ mode, icon: Icon }) => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`p-2 border-2 border-bauhaus-ink ${viewMode === mode ? 'bg-bauhaus-ink text-white' : 'bg-white'}`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-8">
        <div className={`flex gap-6 ${viewMode === 'split' ? 'flex-row' : 'flex-col'}`}>
          {viewMode !== 'map' && (
            <div className={`${viewMode === 'split' ? 'w-full lg:w-[360px] shrink-0' : 'w-full'}`}>
              {loadingProviders ? (
                <ProviderCardSkeletonList count={viewMode === 'list' ? 6 : 4} />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-bauhaus-canvas border-4 border-bauhaus-ink flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-bauhaus-ink/30" />
                  </div>
                  <div className="font-black text-lg uppercase tracking-tight text-bauhaus-ink">No Providers Found</div>
                  <p className="font-medium text-sm text-bauhaus-ink/50 mt-2">Try widening your proximity or filters</p>
                </div>
              ) : (
                <div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                  {filtered.map((provider) => (
                    <div key={providerKey(provider)} onClick={() => setSelectedProvider(provider)} className="cursor-pointer">
                      <ServiceCard provider={provider} compact={viewMode === 'split'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode !== 'list' && (
            <div className={`${viewMode === 'split' ? 'flex-1 hidden lg:block' : 'w-full'} relative`}>
              <div className="sticky top-24" style={{ height: viewMode === 'split' ? 'calc(100vh - 150px)' : '560px' }}>
                <ProviderMap providers={filtered} selected={selectedProvider} onSelect={setSelectedProvider} userLocation={userLocation} radiusKm={radiusKm} />
                {selectedProvider && (
                  <div className="absolute bottom-4 left-4 right-4 z-[500] bg-white border-4 border-bauhaus-ink shadow-bauhaus-lg p-4 flex items-start gap-4">
                    {selectedProvider.avatar ? (
                      <img src={selectedProvider.avatar} alt={selectedProvider.name} className="w-14 h-14 object-cover border-2 border-bauhaus-ink shrink-0" />
                    ) : (
                      <div className="w-14 h-14 border-2 border-bauhaus-ink bg-bauhaus-yellow shrink-0 flex items-center justify-center font-black text-xs uppercase">
                        {(selectedProvider.name || 'P').slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm uppercase tracking-tight text-bauhaus-ink">{selectedProvider.name}</div>
                      <div className="font-bold text-xs uppercase tracking-wider text-bauhaus-red">{selectedProvider.service}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 text-bauhaus-yellow fill-bauhaus-yellow" />
                        <span className="font-black text-xs">{selectedProvider.rating}</span>
                        <span className="text-bauhaus-ink/40 text-xs">· {selectedProvider.reviews} reviews</span>
                      </div>
                      <div className="mt-1 font-medium text-xs text-bauhaus-ink/50">{selectedProvider.distance} km from you</div>
                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      <span className="font-black text-sm text-bauhaus-ink">PHP {providerVisibleRate(selectedProvider).toLocaleString('en-PH')} start</span>
                      <Link
                        to={`/provider/${providerPathId(selectedProvider)}`}
                        className="px-3 py-1.5 bg-bauhaus-red text-white font-bold text-xs uppercase tracking-wider border-2 border-bauhaus-ink shadow-[2px_2px_0px_0px_black] hover:bg-bauhaus-red/90 transition-all"
                      >
                        View Profile
                      </Link>
                      <button onClick={() => setSelectedProvider(null)} className="p-1 hover:text-bauhaus-red transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

