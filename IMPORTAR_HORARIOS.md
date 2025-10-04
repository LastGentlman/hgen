# 📋 Cómo Importar Horarios desde Excel/Google Sheets

Esta guía te explica cómo crear un horario en una hoja de cálculo (Excel, Google Sheets, etc.) y luego importarlo a HGen.

---

## 📊 Formato del Archivo CSV

### Columnas Requeridas

Tu archivo debe tener **10 columnas** con los siguientes encabezados (exactamente como se muestran):

| Fecha | Día | Turno | Horario | Empleado | Posición | Estado | CoverageTipo | CoverageSucursal | CoverageTurno |
|-------|-----|-------|---------|----------|----------|--------|--------------|------------------|---------------|

### Descripción de cada columna:

1. **Fecha** - Formato: `YYYY-MM-DD` (ejemplo: `2025-01-15`)
2. **Día** - Nombre del día en español (ejemplo: `Lunes`, `Martes`, etc.)
3. **Turno** - Nombre del turno (ejemplo: `TURNO 1`, `TURNO 2`, `TURNO 3`)
4. **Horario** - Horario del turno formato `HH:MM-HH:MM` (ejemplo: `07:00-15:00`)
5. **Empleado** - Nombre completo del empleado (debe existir en el sistema)
6. **Posición** - Posición del empleado: `C1`, `C2`, `C3`, o `EXT`
7. **Estado** - Estado del turno: `assigned`, `rest`, `vacation`, `covering`, `sick`, `absent`
8. **CoverageTipo** - Solo para `covering`: `shift` (cubre otro turno) o `branch` (cubre otra sucursal)
9. **CoverageSucursal** - Solo para `covering` tipo `branch`: `001`, `002`, o `003`
10. **CoverageTurno** - Solo para `covering`: `morning`, `afternoon`, o `night`

---

## 📝 Ejemplo Completo

### Ejemplo 1: Turno Normal (Trabajando)

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 1,07:00-15:00,Juan Perez,C1,assigned,,,
2025-01-15,Lunes,TURNO 1,07:00-15:00,Maria Lopez,C2,assigned,,,
2025-01-15,Lunes,TURNO 1,07:00-15:00,Pedro Garcia,C3,assigned,,,
```

**Explicación:**
- Tres empleados trabajando el TURNO 1 (7am-3pm) el mismo día
- Estado `assigned` = trabajando normalmente
- Las últimas 3 columnas vacías porque no están cubriendo

---

### Ejemplo 2: Descanso

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 2,15:00-23:00,Ana Martinez,C1,rest,,,
```

**Explicación:**
- Ana tiene descanso el 15 de enero en el TURNO 2
- Estado `rest` = día de descanso

---

### Ejemplo 3: Vacaciones

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 3,23:00-07:00,Carlos Ruiz,C2,vacation,,,
2025-01-16,Martes,TURNO 3,23:00-07:00,Carlos Ruiz,C2,vacation,,,
2025-01-17,Miércoles,TURNO 3,23:00-07:00,Carlos Ruiz,C2,vacation,,,
```

**Explicación:**
- Carlos tiene 3 días de vacaciones consecutivos
- Estado `vacation` = vacaciones

---

### Ejemplo 4: Cubriendo Otro Turno (Misma Sucursal)

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 1,07:00-15:00,Sofia Diaz,C1,covering,shift,,afternoon
```

**Explicación:**
- Sofia trabaja TURNO 1 (7am-3pm) pero está cubriendo el TURNO 2 (afternoon)
- `CoverageTipo = shift` (cubre otro turno)
- `CoverageTurno = afternoon` (está cubriendo el turno de la tarde)
- `CoverageSucursal` vacío porque es en la misma sucursal

---

### Ejemplo 5: Cubriendo Otra Sucursal

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 3,23:00-07:00,Luis Torres,C3,covering,branch,003,night
```

**Explicación:**
- Luis trabaja TURNO 3 (11pm-7am) pero está cubriendo en la Sucursal 003
- `CoverageTipo = branch` (cubre otra sucursal)
- `CoverageSucursal = 003` (sucursal que está cubriendo)
- `CoverageTurno = night` (turno nocturno de la sucursal 003)

---

## 🔄 Celdas Combinadas (Merged Cells)

Si usas Excel y combinas celdas para fechas/horarios repetidos, **NO hay problema**. El sistema soporta este formato:

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 1,07:00-15:00,Juan Perez,C1,assigned,,,
,,,,,C2,assigned,,,
,,,,,C3,assigned,,,
```

El sistema automáticamente **rellena** las celdas vacías con los valores anteriores (fill-forward).

---

## ⚙️ Valores Permitidos

### Estados (columna "Estado"):
- `assigned` - Trabajando normalmente
- `rest` - Descanso
- `vacation` - Vacaciones
- `covering` - Cubriendo (requiere llenar columnas coverage)
- `sick` - Enfermo
- `absent` - Ausente

### Posiciones (columna "Posición"):
- `C1` - Posición 1
- `C2` - Posición 2
- `C3` - Posición 3
- `EXT` - Extra

### Turnos (columna "CoverageTurno"):
- `morning` - Turno matutino
- `afternoon` - Turno vespertino
- `night` - Turno nocturno

### Sucursales (columna "CoverageSucursal"):
- `001` - Sucursal 001
- `002` - Sucursal 002
- `003` - Sucursal 003

---

## 📥 Pasos para Importar

### Paso 1: Crear el Archivo en Excel/Google Sheets

1. Abre Excel o Google Sheets
2. Crea las **10 columnas** con los encabezados exactos
3. Llena los datos siguiendo los ejemplos de arriba
4. **Importante**: Los nombres de empleados deben existir en HGen

### Paso 2: Guardar como CSV

**En Excel:**
1. Archivo → Guardar como
2. Tipo: CSV UTF-8 (delimitado por comas) `*.csv`
3. Guardar

**En Google Sheets:**
1. Archivo → Descargar → Valores separados por comas (.csv)

### Paso 3: Importar en HGen

1. Abre HGen en tu navegador
2. Ve a la pestaña **"Grid View"**
3. Click en el menú **"Menú"** (tres puntos)
4. Selecciona **"Importar CSV"**
5. Selecciona tu archivo `.csv`
6. Espera la confirmación

### Paso 4: Verificar

1. Abre la **consola del navegador** (F12)
2. Revisa los mensajes:
   - ✅ `Shifts created: 45` - Se crearon los turnos
   - ✅ `Coverage info restored: 5 shifts` - Se restauró info de cobertura
   - ⚠️ `Empleados no encontrados: [...]` - Empleados que no existen

---

## ⚠️ Problemas Comunes

### ❌ "Empleados no encontrados"

**Problema:** Los nombres en el CSV no coinciden con los del sistema.

**Solución:**
1. Ve a la pestaña **"Empleados"** en HGen
2. Verifica los nombres exactos (mayúsculas, espacios, acentos)
3. Actualiza tu CSV para que coincidan **exactamente**

---

### ❌ "CSV vacío o inválido"

**Problema:** El archivo no tiene el formato correcto.

**Solución:**
1. Verifica que la primera fila tenga los encabezados exactos
2. Verifica que haya al menos 1 fila de datos
3. Guarda como CSV UTF-8 (no como Excel)

---

### ❌ Fechas incorrectas

**Problema:** Las fechas aparecen mal o no se importan.

**Solución:**
1. Usa formato `YYYY-MM-DD` (ejemplo: `2025-01-15`)
2. En Excel, formatea la columna como **Texto** antes de escribir las fechas
3. NO uses formato de fecha de Excel automático

---

### ❌ Coverage no se importa

**Problema:** Los turnos marcados como "covering" no muestran qué están cubriendo.

**Solución:**
1. Verifica que `CoverageTipo` tenga valor `shift` o `branch`
2. Si es `shift`, llena `CoverageTurno` (morning/afternoon/night)
3. Si es `branch`, llena `CoverageSucursal` Y `CoverageTurno`

---

## 💡 Tips y Recomendaciones

### ✅ Antes de importar:

1. **Crea todos los empleados** primero en HGen
2. **Exporta un horario existente** para ver el formato exacto
3. **Usa ese CSV como plantilla** para crear nuevos horarios
4. **Prueba con pocas filas** primero (5-10) antes de hacer el horario completo

### ✅ Organización:

- Ordena tu CSV por: Fecha → Turno → Posición
- Agrupa empleados del mismo turno juntos
- Usa colores en Excel para identificar turnos (no afecta importación)

### ✅ Validación:

- Abre la consola del navegador (F12) al importar
- Lee los mensajes de error detallados
- Verifica que el número de turnos creados sea el esperado

---

## 📞 Soporte

Si tienes problemas:

1. **Revisa la consola del navegador** (F12) - tiene mensajes detallados
2. **Verifica tu CSV** - compara con los ejemplos de este documento
3. **Exporta primero** - usa un CSV exportado como referencia

---

## 📄 Plantilla de Ejemplo

Aquí una plantilla completa para un día con 3 turnos y 3 empleados por turno:

```csv
Fecha,Día,Turno,Horario,Empleado,Posición,Estado,CoverageTipo,CoverageSucursal,CoverageTurno
2025-01-15,Lunes,TURNO 1,07:00-15:00,Juan Perez,C1,assigned,,,
2025-01-15,Lunes,TURNO 1,07:00-15:00,Maria Lopez,C2,assigned,,,
2025-01-15,Lunes,TURNO 1,07:00-15:00,Pedro Garcia,C3,assigned,,,
2025-01-15,Lunes,TURNO 2,15:00-23:00,Ana Martinez,C1,assigned,,,
2025-01-15,Lunes,TURNO 2,15:00-23:00,Carlos Ruiz,C2,rest,,,
2025-01-15,Lunes,TURNO 2,15:00-23:00,Sofia Diaz,C3,assigned,,,
2025-01-15,Lunes,TURNO 3,23:00-07:00,Luis Torres,C1,assigned,,,
2025-01-15,Lunes,TURNO 3,23:00-07:00,Carmen Flores,C2,covering,shift,,afternoon
2025-01-15,Lunes,TURNO 3,23:00-07:00,Roberto Vega,C3,assigned,,,
```

---

**¡Listo!** Con esta guía puedes crear horarios completos en Excel e importarlos a HGen. 🚀
