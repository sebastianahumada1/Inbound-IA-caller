// scripts/test-ghl-calendar.js
import { config } from 'dotenv';
config();

async function testGHLCalendar(calendarId) {
  const GHL_API_KEY = process.env.PREMIER_WELLNESS_GHL_API_KEY || process.env.GHL_API_KEY;
  
  if (!GHL_API_KEY) {
    console.error('❌ GHL_API_KEY no encontrada en .env');
    console.error('   Buscando: PREMIER_WELLNESS_GHL_API_KEY o GHL_API_KEY');
    process.exit(1);
  }
  
  if (!calendarId) {
    console.error('❌ Calendar ID requerido');
    process.exit(1);
  }
  
  console.log('🔍 Testing GHL Calendar API\n');
  console.log(`📅 Calendar ID: ${calendarId}`);
  console.log(`🔑 API Key: ${GHL_API_KEY.substring(0, 10)}...\n`);
  
  // Calcular fechas para la prueba (mañana a las 10 AM EST = 15:00 UTC)
  const requestedDate = new Date('2025-12-23T10:00:00-05:00');
  const startDate = new Date(requestedDate.getTime() - 60 * 60000); // 1 hour before
  const endDateRange = new Date(requestedDate.getTime() + 2 * 60 * 60000); // 2 hours after
  
  const apiUrl = `https://services.leadconnectorhq.com/calendars/${calendarId}/free-slots`;
  const params = new URLSearchParams({
    startDate: startDate.getTime().toString(),
    endDate: endDateRange.getTime().toString(),
  });
  
  const fullUrl = `${apiUrl}?${params.toString()}`;
  
  console.log('📡 Request Details:');
  console.log('─'.repeat(80));
  console.log(`URL: ${apiUrl}`);
  console.log(`Params:`);
  console.log(`  startDate: ${startDate.getTime()} (${startDate.toISOString()})`);
  console.log(`  endDate: ${endDateRange.getTime()} (${endDateRange.toISOString()})`);
  console.log(`Full URL: ${fullUrl}\n`);
  
  try {
    console.log('🔄 Making request to GHL Calendar API...\n');
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
    });
    
    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);
    
    const contentType = response.headers.get('content-type');
    let responseData;
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      console.log('⚠️  Response is not JSON:');
      console.log(text);
      return;
    }
    
    if (!response.ok) {
      console.log('❌ Error Response:');
      console.log(JSON.stringify(responseData, null, 2));
      return;
    }
    
    console.log('✅ Success! Response received\n');
    console.log('='.repeat(80));
    console.log('📦 FULL RESPONSE STRUCTURE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(responseData, null, 2));
    console.log('\n' + '='.repeat(80));
    
    // Analizar estructura
    console.log('\n🔎 RESPONSE ANALYSIS:');
    console.log('─'.repeat(80));
    
    console.log('\n📋 Top-level keys:', Object.keys(responseData));
    
    // Buscar slots en diferentes ubicaciones posibles
    const possibleLocations = [
      { path: 'responseData.slots', value: responseData.slots },
      { path: 'responseData.data.slots', value: responseData.data?.slots },
      { path: 'responseData.items', value: responseData.items },
      { path: 'responseData.data', value: responseData.data },
      { path: 'responseData (array)', value: Array.isArray(responseData) ? responseData : null },
    ];
    
    console.log('\n🔍 Searching for slots in different locations:');
    possibleLocations.forEach(({ path, value }) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          console.log(`✓ Found array at ${path} with ${value.length} items`);
          if (value.length > 0) {
            console.log(`  First item:`, JSON.stringify(value[0], null, 2));
          }
        } else if (typeof value === 'object') {
          console.log(`✓ Found object at ${path}`);
          console.log(`  Keys:`, Object.keys(value));
        } else {
          console.log(`✓ Found value at ${path}:`, value);
        }
      } else {
        console.log(`✗ Nothing found at ${path}`);
      }
    });
    
    // Extraer slots
    const freeSlots = responseData?.slots || 
                     responseData?.data?.slots || 
                     responseData?.items || 
                     (Array.isArray(responseData) ? responseData : []);
    
    console.log('\n📅 FREE SLOTS FOUND:');
    console.log('─'.repeat(80));
    console.log(`Count: ${freeSlots.length}`);
    
    if (freeSlots.length > 0) {
      console.log('\nSlots:');
      freeSlots.forEach((slot, index) => {
        console.log(`\n  Slot ${index + 1}:`);
        console.log(`    Full data:`, JSON.stringify(slot, null, 4));
        
        if (slot.startTime) {
          const start = new Date(slot.startTime);
          console.log(`    Start: ${start.toISOString()} (${start.getTime()})`);
        }
        if (slot.endTime) {
          const end = new Date(slot.endTime);
          console.log(`    End: ${end.toISOString()} (${end.getTime()})`);
        }
      });
    } else {
      console.log('\n⚠️  No free slots found in response');
      console.log('\n💡 Possible reasons:');
      console.log('   1. Calendar has no availability in the requested time range');
      console.log('   2. Calendar is fully booked');
      console.log('   3. Response structure is different than expected');
      console.log('   4. Calendar schedule is not configured');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack:', error.stack);
  }
}

// Get Calendar ID from command line argument or use default
const calendarId = process.argv[2] || 'psFf8HG3ja2b9pf0LDdy';

console.log('📝 Usage: node scripts/test-ghl-calendar.js [CALENDAR_ID]');
console.log(`📝 Using Calendar ID: ${calendarId}\n`);

testGHLCalendar(calendarId);

