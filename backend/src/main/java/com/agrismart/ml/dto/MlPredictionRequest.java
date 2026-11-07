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

    public String findFirstOutOfBoundsError() {
        if (!isComplete()) {
            return "All seven ML features (N, P, K, temperature, humidity, ph, rainfall) must be present and finite";
        }
        if (n < 0.0 || n > 300.0) {
            return "Nitrogen (N) must be between 0 and 300 kg/ha (got " + n + ")";
        }
        if (p < 0.0 || p > 300.0) {
            return "Phosphorus (P) must be between 0 and 300 kg/ha (got " + p + ")";
        }
        if (k < 0.0 || k > 300.0) {
            return "Potassium (K) must be between 0 and 300 kg/ha (got " + k + ")";
        }
        if (temperature < -20.0 || temperature > 60.0) {
            return "Temperature must be between -20 and 60 °C (got " + temperature + ")";
        }
        if (humidity < 0.0 || humidity > 100.0) {
            return "Humidity must be between 0 and 100 % (got " + humidity + ")";
        }
        if (ph < 0.0 || ph > 14.0) {
            return "Soil pH must be between 0 and 14 (got " + ph + ")";
        }
        if (rainfall < 0.0 || rainfall > 1000.0) {
            return "Seasonal rainfall must be between 0 and 1000 mm (got " + rainfall + ")";
        }
        return null;
    }

    public boolean hasValidBounds() {
        return findFirstOutOfBoundsError() == null;
    }
}
