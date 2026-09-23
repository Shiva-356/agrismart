package com.agrismart.weather.provider;

import com.agrismart.exception.WeatherServiceException;
import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.location.ResolvedLocation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OpenMeteoWeatherProviderTest {

    private MockRestServiceServer mockServer;
    private OpenMeteoWeatherProvider weatherProvider;

    private final ResolvedLocation testLocation = new ResolvedLocation(
            17.9705,
            79.5941,
            "Warangal, Telangana, India",
            "Warangal"
    );

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.open-meteo.com");
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        weatherProvider = new OpenMeteoWeatherProvider(restClient, "");
    }

    @Test
    @DisplayName("Maps Open-Meteo success response to genuine WeatherObservation")
    void getCurrentWeatherSuccessMapsAccurately() {
        String json = """
                {
                  "latitude": 17.97,
                  "longitude": 79.59,
                  "current": {
                    "time": "2026-09-23T13:30",
                    "interval": 900,
                    "temperature_2m": 28.5,
                    "relative_humidity_2m": 76.0,
                    "rain": 12.4,
                    "precipitation": 12.4
                  }
                }
                """;

        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        WeatherObservation observation = weatherProvider.getCurrentWeather(testLocation);

        mockServer.verify();

        assertThat(observation).isNotNull();
        assertThat(observation.temperature()).isEqualTo(28.5);
        assertThat(observation.humidity()).isEqualTo(76.0);
        assertThat(observation.rainfall()).isEqualTo(12.4);
        assertThat(observation.source()).contains("Open-Meteo");
        assertThat(observation.source()).contains("Warangal");
        assertThat(observation.observedAt()).isNotNull();
    }

    @Test
    @DisplayName("Uses precipitation value if rain field is null")
    void usesPrecipitationIfRainIsNull() {
        String json = """
                {
                  "latitude": 17.97,
                  "longitude": 79.59,
                  "current": {
                    "time": "2026-09-23T13:30",
                    "temperature_2m": 29.0,
                    "relative_humidity_2m": 70.0,
                    "rain": null,
                    "precipitation": 5.2
                  }
                }
                """;

        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        WeatherObservation observation = weatherProvider.getCurrentWeather(testLocation);

        assertThat(observation.rainfall()).isEqualTo(5.2);
    }

    @Test
    @DisplayName("Provider 503 returns WEATHER_DATA_UNAVAILABLE")
    void providerReturns503ThrowsWeatherDataUnavailable() {
        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("Service temporarily down"));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                });
    }

    @Test
    @DisplayName("Provider 500 returns WEATHER_SERVICE_INVALID_RESPONSE")
    void providerReturns500ThrowsWeatherServiceInvalidResponse() {
        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR).body("Internal error"));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_SERVICE_INVALID_RESPONSE");
                });
    }

    @Test
    @DisplayName("Missing temperature in response throws WEATHER_DATA_UNAVAILABLE")
    void missingTemperatureThrowsWeatherDataUnavailable() {
        String json = """
                {
                  "current": {
                    "temperature_2m": null,
                    "relative_humidity_2m": 76.0,
                    "rain": 0.0
                  }
                }
                """;

        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                    assertThat(ex.getMessage()).contains("temperature");
                });
    }

    @Test
    @DisplayName("Missing humidity in response throws WEATHER_DATA_UNAVAILABLE")
    void missingHumidityThrowsWeatherDataUnavailable() {
        String json = """
                {
                  "current": {
                    "temperature_2m": 28.5,
                    "relative_humidity_2m": null,
                    "rain": 0.0
                  }
                }
                """;

        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                    assertThat(ex.getMessage()).contains("humidity");
                });
    }

    @Test
    @DisplayName("Missing rainfall in response (both rain and precipitation null) throws WEATHER_DATA_UNAVAILABLE (no fake zero fallback)")
    void missingRainfallThrowsWeatherDataUnavailableWithoutFakeZero() {
        String json = """
                {
                  "current": {
                    "temperature_2m": 28.5,
                    "relative_humidity_2m": 75.0,
                    "rain": null,
                    "precipitation": null
                  }
                }
                """;

        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                    assertThat(ex.getMessage()).contains("rainfall");
                });
    }

    @Test
    @DisplayName("NaN temperature in response is rejected")
    void nanTemperatureIsRejected() {
        String json = """
                {
                  "current": {
                    "temperature_2m": "NaN",
                    "relative_humidity_2m": 75.0,
                    "rain": 5.0
                  }
                }
                """;

        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                });
    }

    @Test
    @DisplayName("Malformed provider response throws WEATHER_SERVICE_INVALID_RESPONSE")
    void malformedProviderResponseThrowsInvalidResponse() {
        mockServer.expect(requestTo("https://api.open-meteo.com/v1/forecast?latitude=17.9705&longitude=79.5941&current=temperature_2m,relative_humidity_2m,rain,precipitation"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("not valid json", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> weatherProvider.getCurrentWeather(testLocation))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_SERVICE_INVALID_RESPONSE");
                });
    }
}
