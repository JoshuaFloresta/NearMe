export const toGeoLocation = (coordinates) => {
  const lat = Number(coordinates?.lat);
  const lng = Number(coordinates?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
};

export const addGeoLocation = (provider) => ({
  ...provider,
  geoLocation: provider.geoLocation || toGeoLocation(provider.coordinates),
});

export const normalizeProviderGeoLocations = async (db) => {
  const providers = db.collection('providers');
  const cursor = providers.find({
    $or: [
      { geoLocation: { $exists: false } },
      { geoLocation: null },
      { 'geoLocation.type': { $ne: 'Point' } },
    ],
  });

  for await (const provider of cursor) {
    const geoLocation = toGeoLocation(provider.coordinates);

    if (!geoLocation) {
      continue;
    }

    await providers.updateOne(
      { _id: provider._id },
      { $set: { geoLocation, updatedAt: new Date() } }
    );
  }
};
