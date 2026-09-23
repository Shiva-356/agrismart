package com.agrismart.weather.location;

import com.agrismart.entity.Farm;
import com.agrismart.entity.User;
import com.agrismart.exception.RecommendationPrerequisiteException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OpenMeteoLocationResolverTest {

    private MockRestServiceServer mockServer;
    private OpenMeteoLocationResolver locationResolver;
    private Farm farm;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://geocoding-api.open-meteo.com");
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        locationResolver = new OpenMeteoLocationResolver(restClient, "");

        User farmer = new User();
        farmer.setId(UUID.randomUUID());

        farm = new Farm();
        farm.setId(UUID.randomUUID());
        farm.setUser(farmer);
        farm.setFarmName("Green Valley");
        farm.setLocation("Warangal Rural");
        farm.setDistrict("Warangal");
        farm.setSizeInAcres(BigDecimal.valueOf(5.0));
    }

    @Test
    @DisplayName("Resolves geographic coordinates from combined location and district")
    void resolveCombinedLocationSuccess() {
        String json = """
                {
                  "results": [
                    {
                      "id": 1253184,
                      "name": "Warangal",
                      "latitude": 17.9705,
                      "longitude": 79.5941,
                      "country": "India",
                      "admin1": "Telangana"
                    }
                  ]
                }
                """;

        mockServer.expect(requestTo("https://geocoding-api.open-meteo.com/v1/search?name=Warangal%20Rural,%20Warangal&count=1&language=en&format=json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));

        ResolvedLocation resolved = locationResolver.resolve(farm);

        mockServer.verify();

        assertThat(resolved).isNotNull();
        assertThat(resolved.latitude()).isEqualTo(17.9705);
        assertThat(resolved.longitude()).isEqualTo(79.5941);
        assertThat(resolved.displayName()).contains("Warangal");
    }

    @Test
    @DisplayName("Falls back to district query when combined location has no geocoding match")
    void fallbackToDistrictWhenCombinedQueryHasNoResults() {
        String emptyJson = "{\"results\": []}";
        String districtJson = """
                {
                  "results": [
                    {
                      "id": 1253184,
                      "name": "Warangal",
                      "latitude": 17.9705,
                      "longitude": 79.5941,
                      "country": "India",
                      "admin1": "Telangana"
                    }
                  ]
                }
                """;

        mockServer.expect(requestTo("https://geocoding-api.open-meteo.com/v1/search?name=Warangal%20Rural,%20Warangal&count=1&language=en&format=json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(emptyJson, MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo("https://geocoding-api.open-meteo.com/v1/search?name=Warangal&count=1&language=en&format=json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(districtJson, MediaType.APPLICATION_JSON));

        ResolvedLocation resolved = locationResolver.resolve(farm);

        mockServer.verify();

        assertThat(resolved.latitude()).isEqualTo(17.9705);
        assertThat(resolved.longitude()).isEqualTo(79.5941);
    }

    @Test
    @DisplayName("Throws WEATHER_LOCATION_UNRESOLVED when location cannot be determined (no fallback coordinates)")
    void throwsWeatherLocationUnresolvedWhenBothQueriesFail() {
        String emptyJson = "{\"results\": []}";

        mockServer.expect(requestTo("https://geocoding-api.open-meteo.com/v1/search?name=Warangal%20Rural,%20Warangal&count=1&language=en&format=json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(emptyJson, MediaType.APPLICATION_JSON));

        mockServer.expect(requestTo("https://geocoding-api.open-meteo.com/v1/search?name=Warangal&count=1&language=en&format=json"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(emptyJson, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> locationResolver.resolve(farm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_LOCATION_UNRESOLVED");
                });
    }

    @Test
    @DisplayName("Throws WEATHER_LOCATION_UNRESOLVED when farm has blank location and district")
    void throwsWeatherLocationUnresolvedWhenBlankLocationAndDistrict() {
        farm.setLocation("");
        farm.setDistrict("");

        assertThatThrownBy(() -> locationResolver.resolve(farm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_LOCATION_UNRESOLVED");
                });
    }
}
