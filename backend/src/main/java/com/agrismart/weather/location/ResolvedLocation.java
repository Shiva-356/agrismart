package com.agrismart.weather.location;

/**
 * Validated geographic coordinates resolved for a farm's textual location and district.
 *
 * Guarantees numeric integrity: coordinates must never be NaN, Infinite, or outside valid Earth bounds.
 */
public record ResolvedLocation(
        double latitude,
        double longitude,
        String displayName,
        String queryUsed
) {
    public ResolvedLocation {
        if (Double.isNaN(latitude) || Double.isInfinite(latitude) || latitude < -90.0 || latitude > 90.0) {
            throw new IllegalArgumentException("Latitude must be between -90.0 and 90.0 degrees: " + latitude);
        }
        if (Double.isNaN(longitude) || Double.isInfinite(longitude) || longitude < -180.0 || longitude > 180.0) {
            throw new IllegalArgumentException("Longitude must be between -180.0 and 180.0 degrees: " + longitude);
        }
    }
}
