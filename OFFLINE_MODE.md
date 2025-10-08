# 🌐 Modo Híbrido Offline/Online

HGen ahora funciona completamente offline con sincronización automática cuando vuelve la conexión.

## 🎯 ¿Cómo Funciona?

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│                  USUARIO HACE CAMBIO                     │
│              (crear, editar, eliminar)                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│   1️⃣  GUARDAR EN LOCALSTORAGE (INMEDIATO) ✅          │
│       → Aplicación responde instantáneamente            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   ¿HAY INTERNET?     │
              └──────────┬───────────┘
                  ┌──────┴──────┐
                  │             │
                  SÍ           NO
                  │             │
                  ▼             ▼
    ┌──────────────────┐  ┌──────────────────────┐
    │ 2️⃣ Sincronizar   │  │ 2️⃣ Agregar a Cola    │
    │    con Supabase  │  │    de Pendientes     │
    │        ✅         │  │         ⏳            │
    └──────────────────┘  └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │  Cuando vuelve       │
                          │  conexión:           │
                          │  Auto-sincronizar 🔄 │
                          └──────────────────────┘
```

## ✅ Características

### 1. **100% Funcional Offline**
- Crear empleados
- Crear y editar horarios
- Asignar turnos
- Exportar a CSV/PDF
- Importar datos

### 2. **Sincronización Automática**
- Detecta cuando vuelve la conexión
- Sincroniza operaciones pendientes automáticamente
- Sin intervención del usuario

### 3. **Indicador Visual**
El botón flotante en la esquina inferior derecha muestra:

| Estado | Icono | Descripción |
|--------|-------|-------------|
| 🌐 Verde | ☁️ | Conectado y sincronizado |
| 🔵 Azul | ⟳ | Sincronizando... |
| 🟡 Amarillo | ⚠️ | Operaciones pendientes |
| 🔴 Rojo | ⚠️ | Error de sincronización |
| ⚪ Gris | ☁️❌ | **Modo Offline** |

### 4. **Cola Inteligente**
- Las operaciones pendientes se muestran con un badge numérico
- Reintentos automáticos (máximo 3 intentos)
- Limpieza automática de operaciones fallidas

## 📱 Casos de Uso

### Escenario 1: Sin Conexión al Iniciar
```
Usuario abre app sin internet
  ↓
✅ App carga datos de localStorage
  ↓
Usuario crea/edita horarios
  ↓
✅ Cambios se guardan localmente
  ↓
Indicador muestra "Modo Offline" con N pendientes
  ↓
Usuario conecta internet
  ↓
🔄 Sincronización automática
  ↓
✅ Indicador cambia a "Sincronizado"
```

### Escenario 2: Pérdida de Conexión Durante Uso
```
Usuario está trabajando online
  ↓
Se pierde conexión
  ↓
✅ App sigue funcionando (usa localStorage)
  ↓
Usuario continúa editando
  ↓
⏳ Operaciones se agregan a cola
  ↓
Vuelve conexión
  ↓
🔄 Auto-sincroniza pendientes
```

### Escenario 3: Multi-Dispositivo
```
Dispositivo A hace cambios offline
  ↓
Dispositivo B hace cambios offline
  ↓
Ambos se conectan
  ↓
🔄 Ambos sincronizan con Supabase
  ↓
⚠️ Last-Write-Wins (última escritura gana)
  ↓
Click en indicador para refrescar desde servidor
```

## 🔧 Sincronización Manual

Si necesitas forzar una sincronización:

1. **Click en el indicador** (botón flotante inferior derecho)
2. La app sincronizará:
   - ⬆️ Operaciones pendientes → Supabase
   - ⬇️ Datos desde Supabase → localStorage

## 🐛 Troubleshooting

### "Operaciones pendientes no se sincronizan"

**Soluciones:**
1. Verifica que tengas conexión a internet
2. Revisa la consola del navegador (F12) para errores
3. Click manual en el indicador para forzar sync
4. Verifica credenciales de Supabase en `.env.local`

### "Datos desactualizados en otro dispositivo"

**Solución:**
- Click en el indicador para refrescar desde servidor
- Los cambios locales más recientes sobrescriben los antiguos

### "Cola de sincronización muy grande"

**Solución:**
- Las operaciones se procesan automáticamente
- Si una operación falla 3 veces, se elimina automáticamente
- Para limpiar manualmente: `localStorage.removeItem('hgen_sync_queue')`

## 🔍 Bajo el Capó

### Archivos Clave

```
hooks/
  └── useOnlineStatus.ts       # Detecta online/offline

lib/
  ├── hybrid-storage.ts         # Capa híbrida localStorage + Supabase
  ├── sync-queue.ts             # Cola de operaciones pendientes
  ├── sync-processor.ts         # Procesa operaciones en cola
  └── storage.ts                # API pública (sin cambios)

components/
  └── SyncIndicator.tsx         # Indicador visual de estado
```

### localStorage Keys

```javascript
'hgen_employees'          // Caché de empleados
'hgen_schedules'          // Caché de horarios
'hgen_sync_queue'         // Cola de operaciones pendientes
'hgen_last_sync'          // Timestamp de última sincronización
```

### Flujo de Sincronización

1. **Detectar conexión**: `navigator.onLine` + eventos
2. **Procesar cola**: Ejecutar operaciones pendientes (FIFO)
3. **Reintentos**: Máximo 3 intentos con backoff exponencial
4. **Pull de servidor**: Actualizar caché con datos frescos
5. **Actualizar UI**: Notificar componentes del nuevo estado

## 📊 Ventajas vs Desventajas

### ✅ Ventajas
- Funciona 100% offline
- Respuesta instantánea (sin esperar red)
- Sincronización transparente
- Resiliente a problemas de conexión
- No requiere cambios en el código existente

### ⚠️ Consideraciones
- **Conflictos**: Last-write-wins (puede sobrescribir cambios)
- **Almacenamiento**: localStorage tiene límite ~5-10MB
- **Sincronización**: Puede tardar si hay muchas operaciones

## 🚀 Próximos Pasos

Posibles mejoras futuras:
- [ ] Resolución inteligente de conflictos (merge en lugar de overwrite)
- [ ] IndexedDB para mayor capacidad de almacenamiento
- [ ] Compresión de datos en localStorage
- [ ] Service Worker para offline completo (PWA)
- [ ] Sincronización selectiva (solo cambios delta)

## 💡 Tips de Uso

1. **Trabajo offline prolongado**: Click periódicamente en el indicador al conectarte para mantener sincronizado
2. **Múltiples dispositivos**: Prefiere un dispositivo "maestro" para ediciones críticas
3. **Export periódico**: Haz backups con la función de export
4. **Monitoreo**: Observa la consola (F12) para logs de sincronización

---

**¿Preguntas?** Revisa los logs en la consola del navegador para diagnóstico detallado.
