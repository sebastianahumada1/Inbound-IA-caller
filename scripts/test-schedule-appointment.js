// scripts/test-schedule-appointment.js
import { config } from 'dotenv';
config();

async function testScheduleAppointment(calendarId, contactId) {
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
  
  if (!contactId) {
    console.error('❌ Contact ID requerido');
    process.exit(1);
  }
  
  console.log('🔍 Testing GHL Calendar Schedule Appointment API\n');
  console.log(`📅 Calendar ID: ${calendarId}`);
  console.log(`👤 Contact ID: ${contactId}`);
  console.log(`🔑 API Key: ${GHL_API_KEY.substring(0, 10)}...\n`);
  
  // Test data: Schedule for tomorrow at 10 AM EST (30 min appointment)
  const startTime = new Date('2025-12-23T10:00:00-05:00');
  const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 minutes
  
  // First, get contact details
  console.log('🔄 Fetching contact details...\n');
  const contactResponse = await fetch(
    `https://services.leadconnectorhq.com/contacts/${contactId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
    }
  );

  if (!contactResponse.ok) {
    console.error('❌ Failed to fetch contact:', contactResponse.status, contactResponse.statusText);
    const errorData = await contactResponse.json();
    console.error(JSON.stringify(errorData, null, 2));
    return;
  }

  const contactData = await contactResponse.json();
  const contact = contactData?.contact || contactData;
  const contactPhone = contact.phone || contact.phoneNumber || '';
  const contactFirstName = contact.firstName || 'Test';
  const contactLastName = contact.lastName || 'Patient';

  console.log('✅ Contact details retrieved:');
  console.log(`   Name: ${contactFirstName} ${contactLastName}`);
  console.log(`   Phone: ${contactPhone}\n`);

  // Use the correct endpoint: /calendars/events/appointments
  const apiUrl = `https://services.leadconnectorhq.com/calendars/events/appointments`;
  
  const payload = {
    calendarId,
    firstName: contactFirstName,
    lastName: contactLastName,
    phone: contactPhone,
    selectedSlot: startTime.toISOString().replace('Z', '-05:00'), // ISO with timezone
    selectedTimezone: 'America/New_York',
    notes: 'Test appointment created via API',
  };
  
  console.log('📡 Request Details:');
  console.log('─'.repeat(80));
  console.log(`URL: ${apiUrl}`);
  console.log(`Payload:`);
  console.log(JSON.stringify(payload, null, 2));
  console.log(`\nSelected Slot: ${payload.selectedSlot}`);
  console.log(`Timezone: ${payload.selectedTimezone}\n`);
  
  try {
    console.log('🔄 Making request to GHL Calendar API...\n');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(payload),
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
      console.log('\n💡 Possible issues:');
      console.log('   1. Contact ID may not exist');
      console.log('   2. Calendar ID may be incorrect');
      console.log('   3. Time format may be incorrect (try ISO string instead of timestamp)');
      console.log('   4. Required fields may be missing');
      return;
    }
    
    console.log('✅ Success! Appointment created\n');
    console.log('='.repeat(80));
    console.log('📦 FULL RESPONSE STRUCTURE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(responseData, null, 2));
    console.log('\n' + '='.repeat(80));
    
    // Analizar respuesta
    console.log('\n🔎 RESPONSE ANALYSIS:');
    console.log('─'.repeat(80));
    
    if (responseData.id) {
      console.log(`✓ Appointment ID: ${responseData.id}`);
    }
    if (responseData.calendarId) {
      console.log(`✓ Calendar ID: ${responseData.calendarId}`);
    }
    if (responseData.contactId) {
      console.log(`✓ Contact ID: ${responseData.contactId}`);
    }
    if (responseData.startTime) {
      const start = new Date(responseData.startTime);
      console.log(`✓ Start Time: ${start.toISOString()}`);
    }
    if (responseData.endTime) {
      const end = new Date(responseData.endTime);
      console.log(`✓ End Time: ${end.toISOString()}`);
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nStack:', error.stack);
  }
}

// Get parameters from command line
const calendarId = process.argv[2] || 'psFf8HG3ja2b9pf0LDdy';
const contactId = process.argv[3] || 'L89U6QgZMkBVFh2Vr2ZI'; // Default contact ID from metadata

console.log('📝 Usage: node scripts/test-schedule-appointment.js [CALENDAR_ID] [CONTACT_ID]');
console.log(`📝 Using Calendar ID: ${calendarId}`);
console.log(`📝 Using Contact ID: ${contactId}\n`);

testScheduleAppointment(calendarId, contactId);

