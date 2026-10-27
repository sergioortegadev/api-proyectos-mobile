// Semilla del grupo (SEMILLAS=grupo): los mismos datos que los mocks de la app React Native
// (uner-mobile-grupo-3/src/mocks), pasados a los ids y formatos de la API.
// Sin SEMILLAS (o con otro valor) se siembra la demo de la cátedra, en seed.ts.
//
// Qué cambia respecto de los mocks, porque la API lo exige:
//  · ids con prefijo (tip-, zon-, cua-, usr-, fot-) y códigos GCHU-<año>-<5 dígitos>;
//  · las zonas son las cuatro de la API (cubren toda la ciudad), con el nombre y el referente
//    de los mocks; la zona de cada reporte se calcula con sus coordenadas;
//  · las fotos son imágenes de muestra generadas por código (no se bajan de internet);
//  · las adhesiones son reales: hay una fila por vecino, así que el contador no se desarma.
import type { DataSource } from 'typeorm';
import type { EstadoReporte } from '../../contract/types.js';
import type { AlmacenArchivos } from '../common/files/file-storage.js';
import type { Reloj } from '../common/clock/clock.js';
import { hashearContrasena } from '../common/auth/passwords.js';
import { anioMesEnZona, parsearInstante } from '../common/dates/dates.js';
import { nuevaClave } from '../common/files/keys.js';
import { puntoEnPoligono } from '../common/geo/polygon.js';
import { nuevoId } from '../common/ids/ids.js';
import { Cuadrilla } from '../modules/catalogs/crew.entity.js';
import { TipoDeReporte } from '../modules/catalogs/report-type.entity.js';
import { Zona } from '../modules/catalogs/zone.entity.js';
import { Adhesion } from '../modules/reports/follow.entity.js';
import { FotoDeReporte } from '../modules/reports/photo.entity.js';
import { Reporte } from '../modules/reports/report.entity.js';
import { formatearCodigo } from '../modules/reports/rules/code.js';
import { CambioDeEstado } from '../modules/reports/status-change.entity.js';
import { Usuario } from '../modules/users/user.entity.js';
import {
  ZONAS_DEMO,
  type CuadrillaDemo,
  type TipoDemo,
  type ZonaDemo,
} from './data/catalogs.js';
import { CONTRASENA_DEMO, type UsuarioDemo } from './data/users.js';
import { fotoDeMuestra } from './media/generate.js';

const OPERADOR = 'usr-operador-1';

// --- Catálogos (MOCK_REPORT_TYPES, MOCK_ZONES, MOCK_CREWS) -------------------------------

const TIPOS_GRUPO: TipoDemo[] = [
  {
    id: 'tip-bache',
    nombre: 'Bacheo y Calzada',
    icono: 'car-outline',
    color: '#E65100',
    areaResponsable: 'Obras Públicas',
  },
  {
    id: 'tip-luminaria',
    nombre: 'Alumbrado Público',
    icono: 'bulb-outline',
    color: '#F57F17',
    areaResponsable: 'Electrotecnia',
  },
  {
    id: 'tip-higiene',
    nombre: 'Higiene y Maleza',
    icono: 'leaf-outline',
    color: '#33691E',
    areaResponsable: 'Higiene Urbana',
  },
  {
    id: 'tip-agua',
    nombre: 'Agua y Cloacas',
    icono: 'water-outline',
    color: '#01579B',
    areaResponsable: 'Obras Sanitarias',
  },
  {
    id: 'tip-semaforo',
    nombre: 'Semaforo',
    icono: 'radio-button-on-outline',
    color: '#14ca23',
    areaResponsable: 'Red Semaforica',
  },
  {
    id: 'tip-otro',
    nombre: 'Otro',
    icono: 'construct-outline',
    color: '#888888',
    areaResponsable: ' ',
  },
];

const DATOS_DE_ZONA: Record<string, { nombre: string; referente: string }> = {
  'zon-norte': { nombre: 'Zona Norte', referente: 'Ing. Carlos Rossi' },
  'zon-este': {
    nombre: 'Zona Centro / Este',
    referente: 'Arq. María Fernandez',
  },
  'zon-oeste': { nombre: 'Zona Oeste', referente: 'Téc. Roberto Gómez' },
  'zon-sur': { nombre: 'Zona Sur', referente: 'Sra. Laura Benítez' },
};

const ZONAS_GRUPO: ZonaDemo[] = ZONAS_DEMO.map((z) => ({
  ...z,
  ...DATOS_DE_ZONA[z.id],
}));

/** Cada cuadrilla vive en la zona de los reportes que tiene asignados. */
const CUADRILLAS_GRUPO: CuadrillaDemo[] = (
  [
    [
      'cua-01',
      'Cuadrilla A - Bacheo Nocturno',
      'zon-norte',
      'Bacheo y Asfalto',
    ],
    ['cua-02', 'Cuadrilla Electrotecnia 1', 'zon-norte', 'Alumbrado Público'],
    ['cua-03', 'Cuadrilla Higiene y Poda 1', 'zon-oeste', 'Maleza y Poda'],
    ['cua-04', 'Cuadrilla Obras Sanitarias 1', 'zon-este', 'Agua y Cloacas'],
    ['cua-05', 'Cuadrilla B - Bacheo Nocturno', 'zon-este', 'Bacheo y Asfalto'],
    ['cua-06', 'Cuadrilla Electrotecnia 2', 'zon-sur', 'Alumbrado Público'],
    ['cua-07', 'Cuadrilla Higiene y Poda 2', 'zon-sur', 'Maleza y Poda'],
    ['cua-08', 'Cuadrilla Obras Sanitarias 2', 'zon-oeste', 'Agua y Cloacas'],
    ['cua-09', 'Cuadrilla Semaforos 1', 'zon-norte', 'Red Semafórica'],
    ['cua-10', 'Cuadrilla Semaforos 2', 'zon-sur', 'Red Semafórica'],
    ['cua-11', 'Cuadrilla Semaforos 3', 'zon-oeste', 'Red Semafórica'],
    ['cua-12', 'Cuadrilla Obras Sanitarias 3', 'zon-sur', 'Agua y Cloacas'],
    ['cua-13', 'Cuadrilla Electrotecnia 3', 'zon-oeste', 'Alumbrado Público'],
  ] as const
).map(([id, nombre, zonaId, especialidad]) => ({
  id,
  nombre,
  zonaId,
  especialidad,
  activa: true,
}));

// --- Usuarios (MOCK_USERS + los autores de los reportes) ---------------------------------
// Todos entran con la contraseña de demo (demo1234).

const VECINOS_DE_RELLENO: UsuarioDemo[] = Array.from(
  { length: 10 },
  (_, i): UsuarioDemo => {
    const n = String(i + 1).padStart(2, '0');
    return {
      id: `usr-demo-${n}`,
      nombre: `Vecino de demo ${n}`,
      email: `demo${n}@gualeguaychu.gov.ar`,
      telefono: null,
      rol: 'vecino',
      zonaId: null,
      avisosActivos: true,
      creadoEn: '2026-05-20T10:00:00-03:00',
    };
  },
);

const USUARIOS_GRUPO: UsuarioDemo[] = [
  {
    id: 'usr-vecino-1',
    nombre: 'Juan Ignacio Pérez',
    email: 'vecino@gualeguaychu.gov.ar',
    telefono: '3446123456',
    rol: 'vecino',
    zonaId: null,
    avisosActivos: true,
    creadoEn: '2026-01-15T08:00:00-03:00',
  },
  {
    id: OPERADOR,
    nombre: 'María Gómez',
    email: 'operador@gualeguaychu.gov.ar',
    telefono: '3446654321',
    rol: 'operador',
    zonaId: 'zon-norte',
    avisosActivos: true,
    creadoEn: '2025-11-10T10:30:00-03:00',
  },
  {
    id: 'usr-vecino-2',
    nombre: 'Pedro Alonso',
    email: 'pedro@mail.com',
    telefono: null,
    rol: 'vecino',
    zonaId: null,
    avisosActivos: true,
    creadoEn: '2026-02-10T09:00:00-03:00',
  },
  {
    id: 'usr-vecino-3',
    nombre: 'Ana Quinteros',
    email: 'ana@correo.com',
    telefono: null,
    rol: 'vecino',
    zonaId: null,
    avisosActivos: true,
    creadoEn: '2026-02-12T09:00:00-03:00',
  },
  ...VECINOS_DE_RELLENO,
];

// --- Reportes (MOCK_REPORTS + MOCK_STATUS_HISTORY) ---------------------------------------

interface CambioGrupo {
  estado: EstadoReporte;
  comentario: string | null;
  operadorId: string | null;
  despuesDeMin: number;
}

interface ReporteGrupo {
  /** rep-<numero> y GCHU-<año>-<numero con 5 dígitos>. */
  numero: number;
  tipoId: string;
  descripcion: string;
  latitud: number;
  longitud: number;
  direccion: string;
  estado: EstadoReporte;
  autorId: string;
  cuadrillaId: string | null;
  adhesiones: number;
  creadoEn: string;
  fotos: { color: [number, number, number]; momento: 'problema' | 'arreglo' }[];
  /** Si falta, el historial se arma con RUTA hasta el estado actual. */
  cambios?: CambioGrupo[];
}

const BACHE: [number, number, number] = [150, 110, 70];
const LUZ: [number, number, number] = [230, 190, 60];
const YUYO: [number, number, number] = [70, 140, 60];
const AGUA: [number, number, number] = [50, 110, 180];
const ARREGLO: [number, number, number] = [90, 160, 90];

const REPORTES_GRUPO: ReporteGrupo[] = [
  {
    numero: 101,
    tipoId: 'tip-bache',
    descripcion:
      'Bache de gran profundidad sobre la calzada dificultando el paso de colectivos.',
    latitud: -33.0094,
    longitud: -58.5172,
    direccion: 'Urquiza 450',
    estado: 'recibido',
    autorId: 'usr-vecino-1',
    cuadrillaId: null,
    adhesiones: 5,
    creadoEn: '2026-09-20T10:15:00-03:00',
    fotos: [{ color: BACHE, momento: 'problema' }],
    cambios: [
      {
        estado: 'recibido',
        comentario:
          'Reporte ingresado por el vecino mediante la aplicación móvil.',
        operadorId: null,
        despuesDeMin: 0,
      },
    ],
  },
  {
    numero: 102,
    tipoId: 'tip-luminaria',
    descripcion:
      'Luminaria LED fuera de servicio en la esquina. Zona muy oscura por la noche.',
    latitud: -33.012,
    longitud: -58.514,
    direccion: '25 de Mayo 820',
    estado: 'asignado',
    autorId: 'usr-vecino-2',
    cuadrillaId: 'cua-02',
    adhesiones: 2,
    creadoEn: '2026-09-21T18:40:00-03:00',
    fotos: [{ color: LUZ, momento: 'problema' }],
    cambios: [
      {
        estado: 'recibido',
        comentario: 'Reporte ingresado por el vecino.',
        operadorId: null,
        despuesDeMin: 0,
      },
      {
        estado: 'asignado',
        comentario:
          'Asignado a Cuadrilla Electrotecnia 1 para inspección y cambio de fotocélula.',
        operadorId: OPERADOR,
        despuesDeMin: 860,
      },
    ],
  },
  {
    numero: 103,
    tipoId: 'tip-higiene',
    descripcion:
      'Acumulación de ramas y maleza alta obstaculizando la visibilidad del peatón.',
    latitud: -33.0055,
    longitud: -58.521,
    direccion: 'Av. Primera Junta 1120',
    estado: 'en_revision',
    autorId: 'usr-vecino-1',
    cuadrillaId: null,
    adhesiones: 0,
    creadoEn: '2026-10-22T08:00:00-03:00',
    fotos: [{ color: YUYO, momento: 'problema' }],
  },
  {
    numero: 104,
    tipoId: 'tip-agua',
    descripcion: 'Pérdida de agua potable en vereda desde hace 2 días.',
    latitud: -33.0182,
    longitud: -58.5098,
    direccion: 'Bolívar 310',
    estado: 'resuelto',
    autorId: 'usr-vecino-3',
    cuadrillaId: 'cua-04',
    adhesiones: 8,
    creadoEn: '2026-09-18T11:30:00-03:00',
    fotos: [
      { color: AGUA, momento: 'problema' },
      { color: ARREGLO, momento: 'arreglo' },
    ],
  },
  {
    numero: 105,
    tipoId: 'tip-bache',
    descripcion: 'Bache profundo en Rocamora 1250.',
    latitud: -33.00877,
    longitud: -58.51408,
    direccion: 'Rocamora 1250',
    estado: 'asignado',
    autorId: 'usr-vecino-2',
    cuadrillaId: 'cua-01',
    adhesiones: 3,
    creadoEn: '2026-09-21T14:20:00-03:00',
    fotos: [{ color: BACHE, momento: 'problema' }],
  },
  {
    numero: 106,
    tipoId: 'tip-bache',
    descripcion: 'Bache en calzada sobre Bolívar 1180.',
    latitud: -33.00922,
    longitud: -58.51442,
    direccion: 'Bolívar 1180',
    estado: 'recibido',
    autorId: 'usr-vecino-3',
    cuadrillaId: null,
    adhesiones: 1,
    creadoEn: '2026-09-22T09:10:00-03:00',
    fotos: [{ color: BACHE, momento: 'problema' }],
  },
  {
    numero: 107,
    tipoId: 'tip-agua',
    descripcion: 'Vertido de cloacas en vía publica.',
    latitud: -33.0182,
    longitud: -58.5098,
    direccion: 'Bolívar 345',
    estado: 'recibido',
    autorId: 'usr-vecino-2',
    cuadrillaId: null,
    adhesiones: 2,
    creadoEn: '2026-10-20T11:30:00-03:00',
    fotos: [{ color: AGUA, momento: 'problema' }],
  },
  {
    numero: 108,
    tipoId: 'tip-higiene',
    descripcion:
      'Yuyos altos en la esquina de diagonal y pedro torcuato, no se puede pasar por ahí, hay muchos mosquitos, y bichos raros, el otro día pasó una historia ocurrente, me encontraba yo en el puebo de pocococo, que en ese entonces se le decía paniaco, eso fue cuando le cambiaron el nombre, entonces, el señor se me acercó y medijo si el sombrero que yo traia era nuevo, y yo le dije...',
    latitud: -33.0182,
    longitud: -58.5098,
    direccion: 'Bolívar 845',
    estado: 'recibido',
    autorId: 'usr-vecino-1',
    cuadrillaId: null,
    adhesiones: 10,
    creadoEn: '2026-10-19T11:30:00-03:00',
    fotos: [{ color: YUYO, momento: 'problema' }],
  },
];

/** Historial por defecto: pasa por cada estado hasta el actual, 90 minutos entre uno y otro. */
const RUTA: Partial<Record<EstadoReporte, EstadoReporte[]>> = {
  recibido: ['recibido'],
  en_revision: ['recibido', 'en_revision'],
  asignado: ['recibido', 'en_revision', 'asignado'],
  resuelto: ['recibido', 'en_revision', 'asignado', 'resuelto'],
};

function historial(r: ReporteGrupo): CambioGrupo[] {
  if (r.cambios) return r.cambios;
  const ruta = RUTA[r.estado] ?? ['recibido', r.estado];
  return ruta.map((estado, i) => ({
    estado,
    comentario: null,
    operadorId: i === 0 ? null : OPERADOR,
    despuesDeMin: i * 90,
  }));
}

// --- Siembra -----------------------------------------------------------------------------

export async function sembrarDelGrupo(
  dataSource: DataSource,
  almacen: AlmacenArchivos,
  reloj: Reloj,
): Promise<void> {
  await sembrarLista(dataSource, TipoDeReporte, TIPOS_GRUPO);
  await sembrarLista(dataSource, Zona, ZONAS_GRUPO);
  await sembrarLista(dataSource, Cuadrilla, CUADRILLAS_GRUPO);
  await sembrarUsuarios(dataSource);
  await sembrarReportes(dataSource, almacen, reloj);
}

/** Inserta lo que falta (por id). */
async function sembrarLista<T extends { id: string }>(
  dataSource: DataSource,
  entidad: new () => object,
  datos: T[],
): Promise<void> {
  const repo = dataSource.getRepository(entidad);
  for (const d of datos) {
    if (await repo.existsBy({ id: d.id } as never)) continue;
    await repo.insert(d as never);
  }
}

async function sembrarUsuarios(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Usuario);
  const hash = await hashearContrasena(CONTRASENA_DEMO);
  for (const u of USUARIOS_GRUPO) {
    if (await repo.existsBy({ id: u.id })) continue;
    const creadoEn = parsearInstante(u.creadoEn);
    if (!creadoEn) throw new Error(`Fecha inválida en la semilla de ${u.id}`);
    await repo.insert({ ...u, contrasenaHash: hash, creadoEn });
  }
}

async function sembrarReportes(
  dataSource: DataSource,
  almacen: AlmacenArchivos,
  reloj: Reloj,
): Promise<void> {
  const ahora = reloj.ahora();
  const minutos = (desde: Date, min: number) =>
    new Date(desde.getTime() + min * 60_000);
  for (const d of REPORTES_GRUPO) {
    const id = `rep-${d.numero}`;
    if (await dataSource.getRepository(Reporte).existsBy({ id })) continue;
    const creadoEn = parsearInstante(d.creadoEn);
    if (!creadoEn) throw new Error(`Fecha inválida en la semilla de ${id}`);
    const anio = Number(anioMesEnZona(creadoEn).anio);
    const zonaId = ZONAS_GRUPO.find((z) =>
      puntoEnPoligono({ latitud: d.latitud, longitud: d.longitud }, z.limite),
    )?.id;
    if (!zonaId) throw new Error(`El reporte ${id} cae fuera de las zonas`);

    const fotos: FotoDeReporte[] = [];
    for (const [i, f] of d.fotos.entries()) {
      const clave = nuevaClave('imagen', 'png', ahora);
      await almacen.guardar(clave, fotoDeMuestra(f.color), 'image/png');
      fotos.push(
        Object.assign(new FotoDeReporte(), {
          id: `fot-${d.numero}-${i + 1}`,
          reporteId: id,
          clave,
          momento: f.momento,
          orden: i + 1,
        }),
      );
    }
    const cambios = historial(d).map((c, i) =>
      Object.assign(new CambioDeEstado(), {
        id: nuevoId('cam'),
        reporteId: id,
        estado: c.estado,
        comentario: c.comentario,
        operadorId: c.operadorId,
        fechaHora: minutos(creadoEn, c.despuesDeMin),
        secuencia: i + 1,
      }),
    );
    const adhesiones = VECINOS_DE_RELLENO.slice(0, d.adhesiones).map(
      (vecino, i) =>
        Object.assign(new Adhesion(), {
          id: nuevoId('adh'),
          reporteId: id,
          usuarioId: vecino.id,
          creadoEn: minutos(creadoEn, 30 + i * 45),
        }),
    );
    await dataSource.transaction(async (manager) => {
      await manager.insert(
        Reporte,
        Object.assign(new Reporte(), {
          id,
          codigo: formatearCodigo(anio, d.numero),
          tipoId: d.tipoId,
          descripcion: d.descripcion,
          audioClave: null,
          latitud: d.latitud,
          longitud: d.longitud,
          direccion: d.direccion,
          zonaId,
          estado: d.estado,
          autorId: d.autorId,
          cuadrillaId: d.cuadrillaId,
          duplicadoDe: null,
          adhesiones: adhesiones.length,
          creadoEn,
        }),
      );
      await manager.insert(FotoDeReporte, fotos);
      await manager.insert(CambioDeEstado, cambios);
      if (adhesiones.length > 0) await manager.insert(Adhesion, adhesiones);
    });
  }
}
