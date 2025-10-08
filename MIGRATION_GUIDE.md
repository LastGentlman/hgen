# Guía de Migración a Supabase

Esta guía te ayudará a completar la migración de HGen a Supabase y habilitar el sistema de ML para mejorar la generación de horarios.

## ✅ Completado

- [x] Instalación de dependencias (`@supabase/supabase-js`)
- [x] Configuración de variables de entorno
- [x] Diseño del esquema de base de datos
- [x] Creación del cliente Supabase
- [x] Migración de `lib/storage.ts` a API async
- [x] Actualización de todos los componentes a operaciones async
- [x] Sistema de tracking de ediciones para ML

## 🚀 Pasos Pendientes

### 1. Crear Proyecto en Supabase (5 minutos)

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta
2. Haz clic en "New Project"
3. Rellena la información:
   - **Name**: HGen Production
   - **Database Password**: (guarda esto de forma segura)
   - **Region**: Selecciona la más cercana a tus usuarios
4. Espera a que el proyecto se cree (~2 minutos)

### 2. Obtener Credenciales (2 minutos)

1. En tu proyecto de Supabase, ve a **Settings** → **API**
2. Copia los siguientes valores:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. Configurar Variables de Entorno (1 minuto)

1. Abre el archivo `.env.local` en la raíz del proyecto
2. Reemplaza los placeholders con tus credenciales:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

⚠️ **IMPORTANTE**: Asegúrate de que `.env.local` esté en tu `.gitignore` para no subir las credenciales a Git.

### 4. Ejecutar el Script de Base de Datos (3 minutos)

1. En Supabase, ve a **SQL Editor**
2. Crea una nueva query
3. Copia y pega el contenido completo de `supabase-schema.sql`
4. Haz clic en **RUN** (o presiona `Ctrl/Cmd + Enter`)
5. Verifica que todas las tablas se crearon correctamente:
   - Ve a **Table Editor** y confirma que existen:
     - `employees`
     - `schedules`
     - `schedule_edits`
     - `schedule_metrics`

### 5. Probar la Aplicación (5 minutos)

```bash
npm run dev
```

Prueba las siguientes funcionalidades:
- ✅ Crear empleados
- ✅ Crear horarios
- ✅ Asignar turnos
- ✅ Exportar a CSV/PDF
- ✅ Importar datos

### 6. Migrar Datos Existentes (Opcional)

Si tenías datos en localStorage que quieres migrar:

1. Abre la aplicación **ANTES** de cambiar a Supabase
2. Ve a la pestaña de Employees
3. Usa la función de export para descargar tus datos como JSON
4. Después de configurar Supabase, usa la función de import para cargar los datos

## 🤖 Sistema de Tracking para ML (Opcional pero Recomendado)

El sistema de tracking ya está preparado en `lib/tracking.ts`. Para habilitarlo completamente:

### Integrar Tracking en los Componentes

Abre `components/GridView.tsx` y agrega el tracking en las funciones de edición:

```typescript
import { trackEmployeeAssignment, trackStatusChange } from '@/lib/tracking'

// En la función donde asignas empleados:
const handleAssignEmployee = async (shiftId: string, employeeId: string) => {
  const oldEmployeeId = shift.employeeId

  // ... tu lógica de asignación ...

  // Track para ML
  await trackEmployeeAssignment(
    schedule.id,
    shiftId,
    oldEmployeeId,
    employeeId,
    { startTime: shift.startTime, endTime: shift.endTime, date: shift.date }
  )
}

// En la función donde cambias el estado:
const handleStatusChange = async (shiftId: string, newStatus: string) => {
  const oldStatus = shift.status

  // ... tu lógica de cambio de estado ...

  // Track para ML
  await trackStatusChange(
    schedule.id,
    shiftId,
    oldStatus,
    newStatus,
    shift.employeeId
  )
}
```

### Ver Estadísticas de Ediciones

Puedes crear un componente de analytics para visualizar:

```typescript
import { getEditStatistics } from '@/lib/tracking'

const stats = await getEditStatistics(scheduleId)
console.log('Ediciones totales:', stats.totalEdits)
console.log('Por tipo:', stats.editsByType)
console.log('Turnos más editados:', stats.mostEditedShifts)
```

## 📊 Beneficios del Sistema ML

Con el tracking implementado, la base de datos aprenderá:

1. **Patrones de Asignación**
   - Qué empleados se asignan frecuentemente juntos
   - Qué combinaciones de turnos funcionan mejor
   - Qué asignaciones son más estables (menos ediciones)

2. **Conflictos Comunes**
   - Qué turnos requieren más correcciones
   - Qué empleados generan más reasignaciones
   - Patrones de disponibilidad real vs declarada

3. **Optimización Futura**
   - Sugerir asignaciones automáticas basadas en historial
   - Detectar conflictos potenciales antes de que ocurran
   - Predecir qué horarios necesitarán más ajustes

## 🔒 Seguridad y Row Level Security (RLS)

El esquema incluye políticas RLS permisivas para desarrollo. **En producción**, deberías:

1. Implementar autenticación de usuarios en Supabase
2. Actualizar las políticas RLS para restringir acceso por usuario/organización
3. Ejemplo de política restrictiva:

```sql
-- Solo permitir a usuarios autenticados ver sus propios datos
CREATE POLICY "Users can view own data" ON employees
  FOR SELECT USING (auth.uid() = user_id);
```

## 🐛 Troubleshooting

### Error: "Faltan las credenciales de Supabase"
- Verifica que `.env.local` tenga las variables correctas
- Reinicia el servidor de desarrollo (`npm run dev`)

### Error: "Failed to fetch"
- Verifica que la URL de Supabase sea correcta (debe empezar con `https://`)
- Verifica tu conexión a Internet
- Revisa la consola del navegador para más detalles

### Tablas no se crean
- Asegúrate de ejecutar TODO el script `supabase-schema.sql`
- Revisa si hay errores en el SQL Editor
- Verifica que la extensión UUID esté habilitada

### Datos no aparecen
- Abre las DevTools → Network y verifica las llamadas a Supabase
- Revisa la tabla en el Table Editor de Supabase
- Verifica que las políticas RLS permitan las operaciones

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [API JavaScript de Supabase](https://supabase.com/docs/reference/javascript/introduction)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)

## 🎉 ¡Listo!

Una vez completados estos pasos, tu aplicación estará funcionando con Supabase y lista para escalar.

¿Preguntas? Revisa los logs en la consola del navegador y en la terminal del servidor.
