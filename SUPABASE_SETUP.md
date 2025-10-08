# 🚀 Setup Rápido de Supabase

Este documento proporciona instrucciones paso a paso para configurar Supabase en HGen.

## Resumen de Cambios

HGen ahora usa **Supabase** como base de datos en lugar de localStorage del navegador. Esto permite:

✅ **Persistencia real de datos** - Los datos no se pierden al limpiar el navegador
✅ **Acceso multi-dispositivo** - Accede a tus horarios desde cualquier lugar
✅ **Escalabilidad** - Soporta múltiples usuarios y grandes volúmenes de datos
✅ **Preparación para ML** - Sistema de tracking para aprender de patrones y mejorar sugerencias

---

## 📋 Checklist de Setup (15 minutos)

### 1️⃣ Crear Cuenta en Supabase
- [ ] Ir a [supabase.com](https://supabase.com)
- [ ] Crear cuenta gratuita
- [ ] Crear nuevo proyecto
- [ ] Guardar la contraseña de la base de datos

### 2️⃣ Configurar Base de Datos
- [ ] Ir a SQL Editor en Supabase
- [ ] Copiar contenido de `supabase-schema.sql`
- [ ] Ejecutar el script completo
- [ ] Verificar que se crearon 4 tablas: `employees`, `schedules`, `schedule_edits`, `schedule_metrics`

### 3️⃣ Configurar Variables de Entorno
- [ ] Copiar Project URL desde Settings → API
- [ ] Copiar anon key desde Settings → API
- [ ] Abrir `.env.local` en la raíz del proyecto
- [ ] Pegar las credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUz...
```

### 4️⃣ Probar la Aplicación
- [ ] Ejecutar `npm run dev`
- [ ] Crear un empleado de prueba
- [ ] Crear un horario de prueba
- [ ] Verificar que los datos persisten al recargar la página

---

## 🗂️ Estructura de la Base de Datos

### Tabla: `employees`
Almacena información de empleados con sus disponibilidades y asignaciones de turno.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| name | TEXT | Nombre del empleado |
| available_days | TEXT[] | Días disponibles |
| assigned_shift | TEXT | Turno asignado (morning/afternoon/night) |
| branch_code | TEXT | Código de sucursal (001/002/003) |
| division | TEXT | División (super/gasolinera/restaurant/limpieza) |

### Tabla: `schedules`
Almacena los horarios generados con todos sus turnos.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Identificador único |
| name | TEXT | Nombre del horario |
| start_date | DATE | Fecha de inicio del ciclo de 15 días |
| end_date | DATE | Fecha de fin |
| days | JSONB | Array de días con turnos (ScheduleDay[]) |
| created_at | TIMESTAMPTZ | Fecha de creación |

### Tabla: `schedule_edits` (Para ML)
Registra cada edición que hace el usuario para aprender patrones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| schedule_id | UUID | Referencia al horario |
| shift_id | TEXT | ID del turno editado |
| edit_type | TEXT | Tipo: assign/unassign/reassign/status_change |
| original_value | JSONB | Valor antes de la edición |
| new_value | JSONB | Valor después de la edición |
| edited_at | TIMESTAMPTZ | Timestamp de la edición |

### Tabla: `schedule_metrics` (Para ML)
Guarda métricas de calidad de cada horario generado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| schedule_id | UUID | Referencia al horario |
| total_shifts | INTEGER | Total de turnos |
| assigned_shifts | INTEGER | Turnos asignados |
| edit_count | INTEGER | Número de ediciones manuales |
| completion_time_minutes | INTEGER | Tiempo para completar el horario |

---

## 🤖 Sistema de ML (Opcional)

El sistema de tracking está preparado en `lib/tracking.ts`. Para habilitarlo:

```typescript
import { trackEmployeeAssignment } from '@/lib/tracking'

// Al asignar un empleado a un turno:
await trackEmployeeAssignment(
  scheduleId,
  shiftId,
  previousEmployeeId,
  newEmployeeId,
  { date: shift.date, startTime: shift.startTime }
)
```

Con el tiempo, esto permitirá:
- 🎯 Sugerir asignaciones automáticas basadas en patrones históricos
- 🚨 Detectar conflictos comunes antes de que ocurran
- 📊 Analizar qué combinaciones de turnos funcionan mejor
- 🔄 Optimizar la generación inicial de horarios

---

## 🔐 Seguridad en Producción

⚠️ El esquema actual usa políticas RLS permisivas (desarrollo). Para producción:

1. Habilita autenticación de Supabase
2. Actualiza las políticas RLS:

```sql
-- Ejemplo: Restringir acceso por usuario
CREATE POLICY "Users see own data" ON employees
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 📊 Ventajas sobre localStorage

| Característica | localStorage | Supabase |
|----------------|--------------|----------|
| Persistencia | ❌ Se borra fácilmente | ✅ Permanente |
| Multi-dispositivo | ❌ Solo un navegador | ✅ Cualquier dispositivo |
| Colaboración | ❌ No soportado | ✅ Múltiples usuarios |
| Backups | ❌ Manual | ✅ Automático |
| Analytics | ❌ No disponible | ✅ Tracking completo |
| Escalabilidad | ❌ Limitado (5-10MB) | ✅ Ilimitado |

---

## 🆘 Solución de Problemas

### "Faltan las credenciales de Supabase"
**Solución**: Verifica que `.env.local` tenga las variables correctas y reinicia el servidor.

### "Failed to fetch" o errores de red
**Solución**:
1. Verifica que la URL sea correcta (debe empezar con `https://`)
2. Revisa tu conexión a Internet
3. Verifica que el proyecto de Supabase esté activo

### Los datos no aparecen
**Solución**:
1. Abre las DevTools (F12) → Tab Network
2. Busca las llamadas a `supabase.co`
3. Revisa si hay errores 401/403 (credenciales incorrectas) o 404 (URL incorrecta)
4. Verifica en Table Editor de Supabase que los datos existan

### Tablas no se crean
**Solución**:
1. Copia TODO el contenido de `supabase-schema.sql`
2. Pégalo en el SQL Editor
3. Ejecuta todo de una vez (no línea por línea)
4. Revisa que no haya errores de sintaxis

---

## 📚 Recursos

- [Documentación Supabase](https://supabase.com/docs)
- [Dashboard de Supabase](https://app.supabase.com)
- [Guía de migración completa](./MIGRATION_GUIDE.md)

---

## ✅ Verificación Final

Después del setup, verifica que:
- ✅ Puedes crear empleados y aparecen en la tabla de Supabase
- ✅ Puedes crear horarios y persisten al recargar
- ✅ Las asignaciones de turnos se guardan correctamente
- ✅ Puedes exportar a CSV/PDF sin problemas

**¡Listo para usar!** 🎉
