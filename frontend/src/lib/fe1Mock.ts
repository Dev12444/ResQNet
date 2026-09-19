import { Alert, Facility, Incident, Recommendation, Resource } from '@/types/fe1';

export const incidents: Incident[] = [
 {id:'i1',code:'INC-0007',type:'flood',severity:5,priority:'P1',status:'new',title:'Vehicle trapped in Akhbarnagar underpass',address:'Akhbarnagar Underpass, Ahmedabad',lat:23.0569,lng:72.5521,reportCount:7,createdAt:'2 min ago',aiSummary:'Rapidly rising floodwater has trapped a vehicle with occupants at Akhbarnagar underpass. Multiple citizen and call reports corroborate the same location. Rescue boat support is recommended immediately.',reasoning:'Seven reports converge within the flood duplicate window; trapped people and rising water elevate severity to 5.',confidence:.96,hazards:['trapped_people','rising_water'],peopleAffected:4,actions:['Deploy rescue boat / NDRF team','Approach from the north access road','Keep ambulance on standby'],reports:[{id:'r1',source:'citizen',lang:'Gujarati',time:'12:28',text:'અખબારનગર અંડરપાસમાં ગાડી ફસાઈ છે, પાણી વધી રહ્યું છે'},{id:'r2',source:'call',lang:'English',time:'12:29',text:'Caller reports four people trapped in a car.'},{id:'r3',source:'citizen',lang:'Hindi',time:'12:30',text:'Underpass completely flooded.'}]},
 {id:'i2',code:'INC-0008',type:'industrial',severity:5,priority:'P1',status:'triaged',title:'Gas leak reported at Vatva GIDC',address:'Vatva GIDC Phase 2, Ahmedabad',lat:22.9684,lng:72.6385,reportCount:2,createdAt:'4 min ago',aiSummary:'Potential chemical gas leak in an industrial cluster. Exact substance is unknown; exclusion zone and hazmat response are advised.',reasoning:'Industrial location plus gas_leak hazard triggers P1 regardless of report volume.',confidence:.91,hazards:['gas_leak'],peopleAffected:12,actions:['Dispatch hazmat + fire truck','Establish exclusion zone','Request hospital readiness'],reports:[{id:'r4',source:'field',lang:'English',time:'12:26',text:'Strong chemical odour near storage unit.'},{id:'r5',source:'call',lang:'Gujarati',time:'12:27',text:'ફેક્ટરી વિસ્તારમાં ગેસ લીકની શંકા'}]},
 {id:'i3',code:'INC-0009',type:'fire',severity:4,priority:'P1',status:'dispatched',title:'Commercial complex fire — C.G. Road',address:'C.G. Road, Navrangpura',lat:23.0275,lng:72.5604,reportCount:3,createdAt:'7 min ago',aiSummary:'Fire reported on upper floors of a commercial complex. Smoke is visible from adjacent streets.',reasoning:'Three corroborating reports and likely building occupancy produce high severity.',confidence:.89,hazards:['fire_spread','smoke'],peopleAffected:30,actions:['Maintain evacuation perimeter','Send fire truck to west entrance'],reports:[{id:'r6',source:'citizen',lang:'English',time:'12:23',text:'Fire on third floor.'},{id:'r7',source:'citizen',lang:'Gujarati',time:'12:24',text:'સીજી રોડ પર બિલ્ડિંગમાં આગ લાગી છે'}]},
 {id:'i4',code:'INC-0010',type:'road_accident',severity:3,priority:'P2',status:'dispatched',title:'Multi-vehicle collision near Thaltej',address:'S.G. Highway near Thaltej',lat:23.0492,lng:72.5087,reportCount:2,createdAt:'9 min ago',aiSummary:'Two vehicles involved in a highway collision with traffic building behind the incident.',reasoning:'Collision plus possible injuries; moderate severity until field confirmation.',confidence:.86,hazards:['traffic_blockage'],peopleAffected:5,actions:['Route ambulance through service road','Request police traffic control'],reports:[{id:'r8',source:'citizen',lang:'English',time:'12:21',text:'Two cars collided near Thaltej.'}]},
 {id:'i5',code:'INC-0011',type:'medical',severity:2,priority:'P3',status:'triaged',title:'Elderly resident needs medical help',address:'Maninagar, Ahmedabad',lat:22.9974,lng:72.6042,reportCount:1,createdAt:'12 min ago',aiSummary:'Medical emergency in a waterlogged residential society. Ambulance response requested.',reasoning:'Single report with no immediate hazard flags; severity remains moderate.',confidence:.78,hazards:['waterlogging'],peopleAffected:1,actions:['Dispatch ambulance','Confirm safe access route'],reports:[{id:'r9',source:'citizen',lang:'Hindi',time:'12:18',text:'बुजुर्ग को सांस लेने में दिक्कत है'}]},
 {id:'i6',code:'INC-0012',type:'building_collapse',severity:3,priority:'P2',status:'new',title:'Boundary wall collapse',address:'Behrampura, Ahmedabad',lat:22.9961,lng:72.5942,reportCount:1,createdAt:'16 min ago',aiSummary:'A boundary wall has collapsed after sustained rain. Further structural instability is possible.',reasoning:'Collapse event warrants field inspection and moderate priority.',confidence:.83,hazards:['structural_instability'],peopleAffected:2,actions:['Send fire/NDRF assessment team','Cordon off affected lane'],reports:[{id:'r10',source:'field',lang:'English',time:'12:14',text:'Wall collapsed onto roadside.'}]},
];

export const resources: Resource[] = [
 {id:'u1',callsign:'NDRF-07',kind:'ndrf_team',status:'available',lat:23.073,lng:72.57},
 {id:'u2',callsign:'108-AMD-07',kind:'ambulance',status:'available',lat:23.012,lng:72.579},
 {id:'u3',callsign:'FIRE-12',kind:'fire_truck',status:'assigned',lat:23.035,lng:72.546},
 {id:'u4',callsign:'BOAT-03',kind:'rescue_boat',status:'available',lat:23.041,lng:72.585},
 {id:'u5',callsign:'HAZ-02',kind:'hazmat',status:'available',lat:22.953,lng:72.648},
 {id:'u6',callsign:'POL-19',kind:'police',status:'available',lat:23.043,lng:72.515},
 {id:'u7',callsign:'108-AMD-11',kind:'ambulance',status:'en_route',lat:23.04,lng:72.53},
 {id:'u8',callsign:'FIRE-04',kind:'fire_truck',status:'available',lat:23.0,lng:72.61},
];
export const facilities: Facility[] = [
 {id:'f1',name:'Civil Hospital Ahmedabad',kind:'hospital',lat:23.035,lng:72.585,bedsAvailable:18},
 {id:'f2',name:'SVP Hospital',kind:'hospital',lat:23.024,lng:72.57,bedsAvailable:9},
 {id:'f3',name:'Relief Shelter — Sabarmati',kind:'shelter',lat:23.052,lng:72.575,bedsAvailable:120},
 {id:'f4',name:'Fire Station — Navrangpura',kind:'fire_station',lat:23.034,lng:72.557,bedsAvailable:0},
];
export const alerts: Alert[] = [
 {id:'a1',kind:'critical',message:'P1 flood — people trapped at Akhbarnagar underpass',time:'12:30',acknowledged:false,incidentId:'i1'},
 {id:'a2',kind:'sla_breach',message:'P1 industrial gas leak has not been dispatched for 02:04',time:'12:29',acknowledged:false,incidentId:'i2'},
];

export const recommendations: Recommendation[] = [
 {resource:resources[3],eta:6,score:.94,reason:'Capability fit for flood rescue + closest available water unit'},
 {resource:resources[0],eta:9,score:.91,reason:'NDRF capability match with high load-balance score'},
 {resource:resources[1],eta:7,score:.83,reason:'Ambulance standby for trapped occupants'},
];
