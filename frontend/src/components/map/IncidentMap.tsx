'use client';
/**
 * The GIS command map — FE1's interactive incident map, extended to Gujarat.
 *
 * Preserved from FE1 exactly: react-map-gl/maplibre, fly-to on incident
 * selection, incident/resource/facility markers, navigation and scale
 * controls, and the hazard glow layers under the incident points.
 *
 * Added for the state picture, without disturbing any of that:
 *   - Map / Satellite / Hybrid basemaps
 *   - working layer visibility (the dashboard's Layers popover drives it)
 *   - district risk discs for all 17 districts, clickable
 *   - the cyclone's projected track and storm rings over the Arabian Sea
 *
 * The Ahmedabad scenarios FE1 shipped are untouched and still render on top of
 * the state layer — zooming in from the state view lands on them.
 */
import { Map, Marker, NavigationControl, ScaleControl, Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import { Facility, Incident, Resource } from '@/types/fe1';
import { useEffect, useMemo, useRef } from 'react';
import { Ambulance, Flame, HeartPulse, House, LifeBuoy, Plus, Shield, Siren, Waves, X } from 'lucide-react';
import { ensureMapLibreWorker } from '@/components/layout/maplibreWorker';
import { GUJARAT_DISTRICTS, RISK_META } from '@/lib/constants';
import type { DistrictSituation } from '@/types';

// MapLibre 6 spawns its worker from a separate ESM chunk that Turbopack does
// not emit as a fetchable asset. This points it at the copy in `public/` and
// must run before any Map is constructed, hence module scope rather than an
// effect. See `maplibreWorker.ts` for the full diagnosis.
ensureMapLibreWorker();

export type MapBase = 'map' | 'satellite' | 'hybrid';
export type MapLayerKey =
  | 'incidents'
  | 'units'
  | 'facilities'
  | 'flood'
  | 'cyclone'
  | 'districts'
  | 'roads';

const severityColor=['#17794c','#7a9f2e','#d9860f','#d2601c','#b3202e'];
function IncidentIcon({type}:{type:Incident['type']}){const p={size:15,strokeWidth:2.3}; if(type==='flood')return <Waves {...p}/>; if(type==='fire')return <Flame {...p}/>; if(type==='medical')return <HeartPulse {...p}/>; if(type==='road_accident')return <Siren {...p}/>; if(type==='building_collapse')return <House {...p}/>; if(type==='industrial')return <Shield {...p}/>; return <X {...p}/>}
function ResourceIcon({kind}:{kind:Resource['kind']}){if(kind==='ambulance')return <Ambulance size={11}/>;if(kind==='rescue_boat')return <LifeBuoy size={11}/>;if(kind==='fire_truck')return <Flame size={11}/>;if(kind==='police')return <Shield size={11}/>;return <TruckGlyph/>}
function TruckGlyph(){return <span style={{fontSize:10}}>◆</span>}

const OSM_ATTRIB = '© OpenStreetMap contributors';
const SAT_ATTRIB = 'Imagery © Esri, Maxar, Earthstar Geographics';

/**
 * Projected cyclone track from the Arabian Sea to the Kutch coast.
 * Demo data — drawn dashed and amber so it never reads as an observed
 * position, and labelled as a forecast wherever it is described.
 */
const CYCLONE_TRACK: [number, number][] = [
  [66.4, 20.4], [67.3, 21.3], [68.2, 22.2], [69.0, 22.9], [69.6, 23.4], [69.86, 23.73],
];
/** Storm centre, for the concentric warning rings. */
const STORM_CENTRE: [number, number] = [67.9, 21.9];

function buildStyle(base: MapBase): StyleSpecification {
  const sources: StyleSpecification['sources'] = {
    hazard: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {type:'Feature',properties:{color:'#b3202e'},geometry:{type:'Point',coordinates:[72.5521,23.0569]}},
          {type:'Feature',properties:{color:'#d2601c'},geometry:{type:'Point',coordinates:[72.6385,22.9684]}},
          {type:'Feature',properties:{color:'#1565c0'},geometry:{type:'Point',coordinates:[72.585,23.035]}},
          {type:'Feature',properties:{color:'#d9860f'},geometry:{type:'Point',coordinates:[72.5087,23.0492]}},
        ],
      },
    },
  };
  const layers: StyleSpecification['layers'] = [];

  if (base === 'map') {
    sources.osm = {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, attribution: OSM_ATTRIB, maxzoom: 19,
    };
    layers.push({ id: 'osm-basemap', type: 'raster', source: 'osm' });
  } else {
    sources.satellite = {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, attribution: SAT_ATTRIB, maxzoom: 19,
    };
    layers.push({ id: 'satellite-basemap', type: 'raster', source: 'satellite' });
    if (base === 'hybrid') {
      sources.labels = {
        type: 'raster',
        tiles: ['https://basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}.png'],
        tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO',
      };
      layers.push({ id: 'labels', type: 'raster', source: 'labels' });
    }
  }

  // FE1's hazard glow, preserved.
  layers.push(
    { id:'hazard-glow-outer', type:'circle', source:'hazard', paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,32,11,58,14,95],'circle-color':['get','color'],'circle-opacity':0.13,'circle-blur':1} },
    { id:'hazard-glow-inner', type:'circle', source:'hazard', paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,10,11,18,14,32],'circle-color':['get','color'],'circle-opacity':0.28,'circle-blur':0.75} },
  );

  return { version: 8, sources, layers };
}

export default function IncidentMap({
  incidents, resources, facilities, selectedId, onSelect,
  base = 'map',
  layers,
  districts = [],
  selectedDistrict = null,
  onSelectDistrict,
}:{
  incidents:Incident[];
  resources:Resource[];
  facilities:Facility[];
  selectedId:string|null;
  onSelect:(i:Incident)=>void;
  base?: MapBase;
  layers?: MapLayerKey[];
  districts?: DistrictSituation[];
  selectedDistrict?: string | null;
  onSelectDistrict?: (d: string | null) => void;
}){
 const ref=useRef<MapRef|null>(null);
 const on=(k:MapLayerKey)=>!layers||layers.includes(k);

 useEffect(()=>{const i=incidents.find(x=>x.id===selectedId);if(i&&ref.current)ref.current.flyTo({center:[i.lng,i.lat],zoom:13,duration:850,essential:true});},[selectedId,incidents]);

 // Flying to a district is a state-level move, so it lands at a wider zoom
 // than an incident does.
 useEffect(()=>{
   if(!selectedDistrict||!ref.current)return;
   const d=GUJARAT_DISTRICTS.find(x=>x.name===selectedDistrict);
   if(d)ref.current.flyTo({center:[d.lng,d.lat],zoom:8.6,duration:900,essential:true});
 },[selectedDistrict]);

 const style=useMemo(()=>buildStyle(base),[base]);

 const trackData=useMemo(()=>({
   type:'Feature' as const, properties:{},
   geometry:{type:'LineString' as const,coordinates:CYCLONE_TRACK},
 }),[]);

 const ringData=useMemo(()=>({
   type:'Feature' as const, properties:{},
   geometry:{type:'Point' as const,coordinates:STORM_CENTRE},
 }),[]);

 return <Map ref={ref} initialViewState={{longitude:71.6,latitude:22.9,zoom:6.4}} mapStyle={style} attributionControl={{compact:true}} minZoom={5} maxZoom={16} style={{width:'100%',height:'100%'}}>
   <NavigationControl position="bottom-right" showCompass={true}/><ScaleControl position="bottom-left"/>

   {/* Cyclone system — projected track and warning rings. Demo data. */}
   {on('cyclone')&&<>
     <Source id="storm-rings" type="geojson" data={ringData}>
       <Layer id="storm-ring-outer" type="circle" paint={{'circle-radius':['interpolate',['linear'],['zoom'],5,40,7,110,9,240],'circle-color':'#b3202e','circle-opacity':0.10,'circle-blur':0.9}}/>
       <Layer id="storm-ring-mid" type="circle" paint={{'circle-radius':['interpolate',['linear'],['zoom'],5,24,7,66,9,145],'circle-color':'#d2601c','circle-opacity':0.16,'circle-blur':0.7}}/>
       <Layer id="storm-ring-eye" type="circle" paint={{'circle-radius':['interpolate',['linear'],['zoom'],5,7,7,18,9,40],'circle-color':'#d9860f','circle-opacity':0.34,'circle-blur':0.4}}/>
     </Source>
     <Source id="cyclone-track" type="geojson" data={trackData}>
       <Layer id="cyclone-track-line" type="line" paint={{'line-color':'#d9860f','line-width':2,'line-dasharray':[2,2]}}/>
     </Source>
   </>}

   {/* District risk posture. Discs sit on district centroids — they are a risk
       overlay, not surveyed administrative boundaries, and the legend says so. */}
   {on('districts')&&districts.map(d=>{
     const meta=RISK_META[d.risk];
     const size=22+meta.rank*6;
     const sel=selectedDistrict===d.district;
     return <Marker key={d.district} longitude={d.lng} latitude={d.lat} anchor="center" onClick={e=>{e.originalEvent.stopPropagation();onSelectDistrict?.(sel?null:d.district)}}>
       <div style={{position:'relative',width:size,height:size,cursor:onSelectDistrict?'pointer':'default'}} title={`${d.district} — ${meta.label} risk · ${d.activeIncidents} active incidents`}>
         {d.risk==='critical'&&<span className="halo" style={{position:'absolute',inset:0,borderRadius:'50%',background:meta.color,opacity:.45}}/>}
         <span style={{position:'absolute',inset:0,display:'grid',placeItems:'center',borderRadius:'50%',background:meta.fill,border:`2px solid ${meta.color}`,color:meta.color,fontSize:10,fontWeight:800,boxShadow:sel?`0 0 0 3px #fff, 0 0 0 5px ${meta.color}`:'0 1px 4px rgba(10,26,48,.35)'}}>{d.activeIncidents}</span>
       </div>
     </Marker>;
   })}

   {on('incidents')&&incidents.map(i=><Marker key={i.id} longitude={i.lng} latitude={i.lat} anchor="center" onClick={e=>{e.originalEvent.stopPropagation();onSelect(i)}}>
     <div className={i.priority==='P1'&&i.status==='new'?'pulse':''} title={i.title} style={{position:'relative',width:i.id===selectedId?40:32,height:i.id===selectedId?40:32,borderRadius:'50%',display:'grid',placeItems:'center',background:severityColor[i.severity-1],border:`3px solid ${i.id===selectedId?'#ffffff':'#0d2a52'}`,boxShadow:'0 3px 14px rgba(10,26,48,.45)',color:'#fff',transform:i.id===selectedId?'scale(1.05)':'scale(1)',transition:'all .2s',cursor:'pointer'}}><IncidentIcon type={i.type}/><span style={{position:'absolute',right:-7,top:-7,background:i.priority==='P1'?'#b3202e':'#0d2a52',border:'1px solid #ffffff',color:'#fff',fontSize:8,fontWeight:900,padding:'2px 4px',borderRadius:3}}>{i.priority}</span></div>
   </Marker>)}

   {on('facilities')&&facilities.map(f=><Marker key={f.id} longitude={f.lng} latitude={f.lat} anchor="center"><div title={`${f.name} · ${f.bedsAvailable} available`} style={{width:24,height:24,borderRadius:4,display:'grid',placeItems:'center',background:'#e8f5ee',border:'2px solid #17794c',color:'#17794c',boxShadow:'0 2px 8px rgba(10,26,48,.35)'}}><Plus size={13} strokeWidth={3}/></div></Marker>)}

   {on('units')&&resources.map(r=><Marker key={r.id} longitude={r.lng} latitude={r.lat} anchor="center"><div title={`${r.callsign} · ${r.status.replace('_',' ')}`} style={{width:21,height:21,borderRadius:4,display:'grid',placeItems:'center',background:r.status==='available'?'#e8f1fb':'#fdf6e3',border:`1px solid ${r.status==='available'?'#1565c0':'#d9860f'}`,color:r.status==='available'?'#1565c0':'#b06c08',boxShadow:'0 2px 7px rgba(10,26,48,.3)',transform:'rotate(45deg)'}}><span style={{transform:'rotate(-45deg)',display:'grid',placeItems:'center'}}><ResourceIcon kind={r.kind}/></span></div></Marker>)}
 </Map>
}
