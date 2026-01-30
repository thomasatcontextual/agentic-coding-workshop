const Database = require('better-sqlite3');

const db = new Database('local.db');
db.pragma('journal_mode = WAL');

// Convert Celsius to Fahrenheit in weather_data
console.log('🌡️  Converting temperatures from Celsius to Fahrenheit...');

const result = db.prepare(`
  UPDATE weather_data 
  SET 
    temp_min = (temp_min * 9/5) + 32,
    temp_max = (temp_max * 9/5) + 32,
    temp_avg = (temp_avg * 9/5) + 32
  WHERE temp_avg < 100
`).run();

console.log(`✅ Updated ${result.changes} weather records`);
db.close();
