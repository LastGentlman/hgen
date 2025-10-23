# Reglas de Programación Asistida por IA

Edita este archivo para influir cómo la IA genera los horarios. Estas reglas se inyectan en el prompt del generador.

## Principios generales
- Diseña turnos justos y consistentes con prácticas actuales.
- Prioriza disponibilidad (`availableDays`) y preferencias (`assignedShift`).
- Evita noches consecutivas para la misma persona salvo indicación explícita.
- Reparte equitativamente noches y fines de semana a lo largo de la quincena.
- No asignes a la misma persona dos turnos el mismo día.

## Criterios de negocio (ejemplos, edita a tu gusto)
- Sucursales 001 y 003 requieren al menos 1 C1 en turno Mañana y Tarde.
- Sucursal 002 no tiene `restaurant`.
- En `limpieza`, evitar asignar noches consecutivas.
- Respeta posiciones cuando estén en el nombre (C1/C2/C3/EXT) si hay disponibilidad.

## Preferencias operativas
- Mantén a cada persona en su `assignedShift` la mayor parte del tiempo.
- Distribuye cambios de turno de forma gradual, no abrupta.
- Evita más de 6 días consecutivos trabajados por persona.

## Notas de estilo
- Si no hay suficientes personas disponibles para un turno, deja el turno vacío (estado `empty`).
- No inventes empleados ni posiciones.
