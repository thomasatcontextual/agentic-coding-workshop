const Database = require('better-sqlite3');
const https = require('https');

const db = new Database('local.db');
db.pragma('journal_mode = WAL');

const NYC_LAT = 40.7128;
const NYC_LON = -74.006;

// Get unique commit dates
const commitDates = db.prepare(`
  SELECT DISTINCT DATE(commit_date) as commit_date 
  FROM github_commits 
  ORDER BY commit_date
`).all();

if (commitDates.length === 0) {
  console.log('⚠️  No commit dates found. Sync GitHub data first.');
  process.exit(0);
}

console.log(`   Found ${commitDates.length} unique commit dates`);

const dates = commitDates.map(d => d.commit_date);
const startDate = dates[0];
const endDate = dates[dates.length - 1];

console.log(`   Fetching weather from ${startDate} to ${endDate}...`);

const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${NYC_LAT}&longitude=${NYC_LON}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,cloud_cover_mean,daylight_duration&timezone=America/New_York`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const weather = JSON.parse(data);
      const { daily } = weather;
      
      let weatherAdded = 0;
      
      for (let i = 0; i < daily.time.length; i++) {
        const existing = db.prepare('SELECT id FROM weather_data WHERE date = ?').get(daily.time[i]);
        if (existing) continue;
        
        // Convert Celsius to Fahrenheit
        const tempMin = ((daily.temperature_2m_min[i] || 0) * 9/5) + 32;
        const tempMax = ((daily.temperature_2m_max[i] || 0) * 9/5) + 32;
        const tempAvg = ((daily.temperature_2m_mean[i] || 0) * 9/5) + 32;
        
        db.prepare(`
          INSERT INTO weather_data 
          (date, location, temp_min, temp_max, temp_avg, precipitation, humidity, cloud_cover, daylight_hours)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          daily.time[i],
          'NYC',
          tempMin,
          tempMax,
          tempAvg,
          daily.precipitation_sum[i] || 0,
          Math.round(daily.relative_humidity_2m_mean[i] || 0),
          Math.round(daily.cloud_cover_mean[i] || 0),
          (daily.daylight_duration[i] || 0) / 3600
        );
        weatherAdded++;
      }
      
      console.log(`✅ Weather sync complete!`);
      console.log(`   Weather days added: ${weatherAdded}`);
      db.close();
    } catch (error) {
      console.error('❌ Error parsing weather data:', error.message);
      db.close();
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ Error fetching weather:', error.message);
  db.close();
  process.exit(1);
});
