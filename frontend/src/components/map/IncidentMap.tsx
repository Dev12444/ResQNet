'use client';
import { Map, Marker, NavigationControl, ScaleControl } from 'react-map-gl/maplibre';
import type { Facility, Incident, Resource } from '@/components/command/view';
import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { StyleSpecification } from 'maplibre-gl';
import { Ambulance, Flame, HeartPulse, House, LifeBuoy, Plus, Shield, Siren, Waves, X } from 'lucide-react';

const severityColor=['#22c55e','#84cc16','#f59e0b','#f97316','#7f1d1d'];
function IncidentIcon({type}:{type:Incident['type']}){const p={size:15,strokeWidth:2.3}; if(type==='flood')return <Waves {...p}/>; if(type==='fire')return <Flame {...p}/>; if(type==='medical')return <HeartPulse {...p}/>; if(type==='road_accident')return <Siren {...p}/>; if(type==='building_collapse')return <House {...p}/>; if(type==='industrial')return <Shield {...p}/>; return <X {...p}/>}
function ResourceIcon({kind}:{kind:Resource['kind']}){if(kind==='ambulance')return <Ambulance size={11}/>;if(kind==='rescue_boat')return <LifeBuoy size={11}/>;if(kind==='fire_truck')return <Flame size={11}/>;if(kind==='police')return <Shield size={11}/>;return <TruckGlyph/>}
function TruckGlyph(){return <span style={{fontSize:10}}>◆</span>}
export default function IncidentMap({incidents,resources,facilities,selectedId,onSelect}:{incidents:Incident[];resources:Resource[];facilities:Facility[];selectedId:string|null;onSelect:(i:Incident)=>void}){
 const ref=useRef<MapRef|null>(null);
 useEffect(()=>{const i=incidents.find(x=>x.id===selectedId);if(i&&ref.current)ref.current.flyTo({center:[i.lng,i.lat],zoom:13,duration:850,essential:true});},[selectedId,incidents]);
 // Soft glow under every severe incident (severity >= 4), coloured by type.
 const glow=incidents.filter(i=>i.severity>=4&&i.status!=='resolved').map(i=>({type:'Feature' as const,properties:{color:i.type==='flood'?'#38bdf8':i.type==='industrial'?'#f97316':'#ef4444'},geometry:{type:'Point' as const,coordinates:[i.lng,i.lat]}}));
 const rasterStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 },
    hazard: { type: 'geojson', data: { type: 'FeatureCollection', features: glow }},
  },
  layers: [
    { id: 'osm-basemap', type: 'raster', source: 'osm', paint: { 'raster-opacity': 1 } },
    { id:'hazard-glow-outer', type:'circle', source:'hazard', paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,32,11,58,14,95],'circle-color':['get','color'],'circle-opacity':0.13,'circle-blur':1} },
    { id:'hazard-glow-inner', type:'circle', source:'hazard', paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,10,11,18,14,32],'circle-color':['get','color'],'circle-opacity':0.28,'circle-blur':0.75} },
  ],
};
 return <Map ref={ref} initialViewState={{longitude:72.5714,latitude:23.0225,zoom:11}} mapStyle={rasterStyle} style={{width:'100%',height:'100%'}}>
   <NavigationControl position="bottom-right" showCompass={true}/><ScaleControl position="bottom-left"/>
   {incidents.map(i=><Marker key={i.id} longitude={i.lng} latitude={i.lat} anchor="center" onClick={e=>{e.originalEvent.stopPropagation();onSelect(i)}}>
     <div className={i.priority==='P1'&&i.status==='new'?'pulse':''} title={i.title} style={{width:i.id===selectedId?40:32,height:i.id===selectedId?40:32,borderRadius:'50%',display:'grid',placeItems:'center',background:severityColor[i.severity-1],border:`3px solid ${i.id===selectedId?'#f8fafc':'#07100f'}`,boxShadow:'0 3px 14px #0009',color:'#fff',transform:i.id===selectedId?'scale(1.05)':'scale(1)',transition:'all .2s'}}><IncidentIcon type={i.type}/><span style={{position:'absolute',right:-7,top:-7,background:i.priority==='P1'?'#ef4444':'#182a25',border:'1px solid var(--subbar)',fontSize:8,fontWeight:900,padding:'2px 4px',borderRadius:4}}>{i.priority}</span></div>
   </Marker>)}
   {facilities.map(f=><Marker key={f.id} longitude={f.lng} latitude={f.lat} anchor="center"><div title={f.name} style={{width:24,height:24,borderRadius:'50%',display:'grid',placeItems:'center',background:'#ecfdf5',border:'2px solid #15845f',color:'#15845f',boxShadow:'0 2px 8px #0008'}}><Plus size={13} strokeWidth={3}/></div></Marker>)}
   {resources.map(r=><Marker key={r.id} longitude={r.lng} latitude={r.lat} anchor="center"><div title={r.callsign} style={{width:21,height:21,borderRadius:5,display:'grid',placeItems:'center',background:r.status==='available'?'#163c32':'#34352b',border:'1px solid #68a895',color:r.status==='available'?'#62e0b2':'#c8c28c',boxShadow:'0 2px 7px #0008'}}><ResourceIcon kind={r.kind}/></div></Marker>)}
 </Map>
}
