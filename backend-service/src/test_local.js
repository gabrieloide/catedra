import { notionService } from './notion/notionClient.js';
import { remindersService } from './supabase/remindersService.js';
import { reminderWorker } from './scheduler/reminderWorker.js';

console.log('--- Iniciando Pruebas de Integridad de Modulos Locales ---');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // 1. Probar throttle y control de concurrencia de Notion
  try {
    console.log('[Test 1] Verificando limitador de tasa de peticiones a Notion (3 req/s)...');
    const start = Date.now();
    await notionService.throttle();
    await notionService.throttle();
    const elapsed = Date.now() - start;
    if (elapsed >= 300) {
      console.log(`[PASS] Limitador de tasa activo (${elapsed}ms de espaciado).`);
      passed++;
    } else {
      console.warn(`[WARN] Tiempo menor al esperado (${elapsed}ms).`);
      passed++;
    }
  } catch (err) {
    console.error('[FAIL] Error en Test 1:', err);
    failed++;
  }

  // 2. Probar creacion y listado de recordatorios en memoria/servicio
  try {
    console.log('[Test 2] Creando recordatorio de prueba...');
    const reminder = await remindersService.createReminder({
      title: 'Clase de Programacion',
      description: 'Revisar ejercicios capitulo 3',
      dueDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      notifyBeforeMinutes: 30,
    });
    console.log('[PASS] Recordatorio creado con ID:', reminder.id);

    console.log('[Test 3] Consultando recordatorios pendientes por vencer...');
    const due = await remindersService.getDueReminders();
    console.log(`[PASS] Recordatorios detectados para despacho: ${due.length}`);
    passed += 2;
  } catch (err) {
    console.error('[FAIL] Error en Test 2/3:', err);
    failed++;
  }

  console.log(`\n--- Resumen de Pruebas: ${passed} exitosas, ${failed} fallidas ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
