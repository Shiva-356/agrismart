package com.agrismart.ml.dto;

/**
 * Domain request carrying the exact seven agricultural features required by the crop recommendation ML model.
 */
public record MlPredictionRequest(
        Double n,
        Double p,
        Double k,
        Double temperature,
        Double humidity,
        Double ph,
        Double rainfall
) {
    public boolean isComplete() {
        return n != null && !Double.isNaN(n) && !Double.isInfinite(n)
                && p != null && !Double.isNaN(p) && !Double.isInfinite(p)
                && k != null && !Double.isNaN(k) && !Double.isInfinite(k)
                && temperature != null && !Double.isNaN(temperature) && !Double.isInfinite(temperature)
                && humidity != null && !Double.isNaN(humidity) && !Double.isInfinite(humidity)
                && ph != null && !Double.isNaN(ph) && !Double.isInfinite(ph)
                && rainfall != null && !Double.isNaN(rainfall) && !Double.isInfinite(rainfall);
    }
}
