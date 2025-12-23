#!/usr/bin/env node

/**
 * Test script for schedule_appointment tool
 * Simulates Vapi webhook call locally without making actual phone calls
 * 
 * Usage:
 *   node scripts/test-schedule-appointment-local.js [name] [phone] [startTime] [endTime] [notes] [contactId]
 * 
 * Examples:
 *   node scripts/test-schedule-appointment-local.js
 *   node scripts/test-schedule-appointment-local.js "John Doe" "+1234567890" "2025-12-24T14:00:00-05:00" "2025-12-24T14:30:00-05:00"
 *   node scripts/test-schedule-appointment-local.js "John Doe" "+1234567890" "2025-12-24T14:00:00-05:00" "2025-12-24T14:30:00-05:00" "Test notes" "CONTACT_ID_123"
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Import after env is loaded
const { GHLConnector } = await import('../dist/ghl.js');

async function testScheduleAppointment() {
  console.log('🧪 Testing schedule_appointment locally...\n');

  // Configuration - use environment variables or defaults
  const assistantId = process.env.PREMIER_WELLNESS_ASSISTANT_ID || '053cd610-596c-4632-a90b-a1e398712178';
  const calendarId = process.env.PREMIER_WELLNESS_CALENDAR_ID || 'psFf8HG3ja2b9pf0LDdy';
  const locationId = process.env.PREMIER_WELLNESS_LOCATION_ID;
  
  // Set environment variables if not already set (for testing)
  if (!process.env.PREMIER_WELLNESS_ASSISTANT_ID) {
    process.env.PREMIER_WELLNESS_ASSISTANT_ID = assistantId;
  }
  if (!process.env.PREMIER_WELLNESS_CALENDAR_ID) {
    process.env.PREMIER_WELLNESS_CALENDAR_ID = calendarId;
  }
  if (locationId && !process.env.PREMIER_WELLNESS_LOCATION_ID) {
    process.env.PREMIER_WELLNESS_LOCATION_ID = locationId;
  }
  
  // Re-initialize ClientConfigManager with the set values
  const { ClientConfigManager } = await import('../dist/utils/client-config.js');
  ClientConfigManager.initialize();
  
  console.log('📋 Configuration:');
  console.log(`   Assistant ID: ${assistantId}`);
  console.log(`   Calendar ID: ${calendarId}`);
  console.log(`   Location ID (from env): ${locationId || 'not set'}`);
  console.log(`   API Key: ${process.env.PREMIER_WELLNESS_GHL_API_KEY ? process.env.PREMIER_WELLNESS_GHL_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log('');
  
  if (!process.env.PREMIER_WELLNESS_GHL_API_KEY) {
    console.error('❌ PREMIER_WELLNESS_GHL_API_KEY is required!');
    console.error('   Please set it in your .env file or as an environment variable');
    process.exit(1);
  }

  // Create GHL connector
  const ghlConnector = new GHLConnector(assistantId);
  ghlConnector.setAssistantId(assistantId);

  // Test arguments - puedes modificar estos valores
  const testArgs = {
    name: process.argv[2] || 'Sebastian Developer',
    phone: process.argv[3] || '+573008669878',
    startTime: process.argv[4] || '2025-12-24T14:00:00-05:00',
    endTime: process.argv[5] || '2025-12-24T14:30:00-05:00',
    notes: process.argv[6] || 'Test appointment from local script',
    contactId: process.argv[7] || undefined, // Opcional: pasar contactId si lo tienes
  };
  
  // Si se pasa contactId como argumento, usarlo
  if (testArgs.contactId === 'undefined' || testArgs.contactId === '') {
    delete testArgs.contactId;
  }

  console.log('📞 Test Arguments:');
  console.log(JSON.stringify(testArgs, null, 2));
  console.log('');

  try {
    console.log('🚀 Calling scheduleAppointment...\n');
    
    const result = await ghlConnector.scheduleAppointment(
      'test_local_call_123',
      testArgs,
      null // No ghlMetadata for this test
    );

    console.log('\n✅ Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.ok) {
      console.log('\n✅ SUCCESS! Appointment scheduled successfully.');
      console.log(`   Appointment ID: ${result.data?.appointmentId}`);
      console.log(`   Calendar ID: ${result.data?.calendarId}`);
      console.log(`   Start Time: ${result.data?.startTime}`);
      console.log(`   End Time: ${result.data?.endTime}`);
    } else {
      console.log('\n❌ FAILED!');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.error('\n❌ Exception occurred:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testScheduleAppointment()
  .then(() => {
    console.log('\n✨ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed with error:');
    console.error(error);
    process.exit(1);
  });

