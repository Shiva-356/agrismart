package com.agrismart.dto.soilreport;

/**
 * Diagnostic record exposing explicit availability flags for individual soil measurements.
 *
 * Distinguishes between genuinely available laboratory measurements and missing values,
 * preventing accidental zero-substitution by downstream consumers.
 *
 * isMlFeatureReady is true ONLY when all four soil features required by the crop ML model
 * (nitrogen, phosphorus, potassium, and pH) are non-null. It does NOT imply verification,
 * nor does it include weather features (which are resolved separately in Phase 4B-3).
 */
public record SoilMeasurementAvailability(
        boolean hasNitrogen,
        boolean hasPhosphorus,
        boolean hasPotassium,
        boolean hasPh,
        boolean hasElectricalConductivity,
        boolean hasOrganicCarbon,
        boolean isMlFeatureReady
) {
}
