const OPEN_METEO_BASE_URL = "https://archive-api.open-meteo.com/v1/archive";

export interface WeatherData {
  date: string;
  temp_min: number;
  temp_max: number;
  temp_avg: number;
  precipitation: number;
  humidity: number;
  cloud_cover: number;
  daylight_hours: number;
}

export interface OpenMeteoResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    temperature_2m_mean: number[];
    precipitation_sum: number[];
    relative_humidity_2m_mean: number[];
    cloud_cover_mean: number[];
    daylight_duration: number[];
  };
}

export async function getHistoricalWeather(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<WeatherData[]> {
  const url = new URL(OPEN_METEO_BASE_URL);
  url.searchParams.set("latitude", latitude.toString());
  url.searchParams.set("longitude", longitude.toString());
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,cloud_cover_mean,daylight_duration"
  );
  url.searchParams.set("timezone", "America/New_York");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.statusText}`);
  }

  const data = (await response.json()) as OpenMeteoResponse;
  const { daily } = data;

  const weatherData: WeatherData[] = [];

  for (let i = 0; i < daily.time.length; i++) {
    weatherData.push({
      date: daily.time[i],
      temp_min: daily.temperature_2m_min[i] ?? 0,
      temp_max: daily.temperature_2m_max[i] ?? 0,
      temp_avg: daily.temperature_2m_mean[i] ?? 0,
      precipitation: daily.precipitation_sum[i] ?? 0,
      humidity: Math.round(daily.relative_humidity_2m_mean[i] ?? 0),
      cloud_cover: Math.round(daily.cloud_cover_mean[i] ?? 0),
      daylight_hours: (daily.daylight_duration[i] ?? 0) / 3600, // Convert seconds to hours
    });
  }

  return weatherData;
}

export async function getWeatherForDate(
  latitude: number,
  longitude: number,
  date: string
): Promise<WeatherData | null> {
  const data = await getHistoricalWeather(latitude, longitude, date, date);
  return data[0] ?? null;
}
