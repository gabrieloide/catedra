import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  notion: {
    apiKey: process.env.NOTION_API_KEY || '',
    notesDatabaseId: process.env.NOTION_NOTES_DATABASE_ID || '',
    classesDatabaseId: process.env.NOTION_CLASSES_DATABASE_ID || '',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-2.0-flash',
  },
  whatsapp: {
    targetPhoneNumber: process.env.TARGET_PHONE_NUMBER || '',
    authDir: path.resolve(__dirname, '../auth_session'),
  },
  scheduler: {
    cronExpression: process.env.REMINDER_CRON_SCHEDULE || '* * * * *',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
};
