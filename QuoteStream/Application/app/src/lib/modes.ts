import type { Basis } from './money';
import type { Mode } from './weight';

export type ServiceDef = { name: string; basis: Basis; mode: Mode | 'Any' };

export const SERVICES: ServiceDef[] = [
  { name: 'Origin Charges', basis: 'kg', mode: 'Air' },
  { name: 'Airfreight', basis: 'kg', mode: 'Air' },
  { name: 'Fuel Surcharge', basis: 'kg', mode: 'Any' },
  { name: 'Security Surcharge', basis: 'kg', mode: 'Air' },
  { name: 'Export Customs', basis: 'shipment', mode: 'Any' },
  { name: 'Import Customs', basis: 'shipment', mode: 'Any' },
  { name: 'Transportation', basis: 'shipment', mode: 'Any' },
  { name: 'Ocean Freight', basis: 'cbm', mode: 'Sea' },
  { name: 'Origin Terminal Handling', basis: 'cbm', mode: 'Sea' },
  { name: 'Destination Port Clearance', basis: 'shipment', mode: 'Sea' },
  { name: 'On-carriage', basis: 'shipment', mode: 'Sea' },
  { name: 'Courier Service', basis: 'kg', mode: 'Courier' },
  { name: 'Road Freight', basis: 'shipment', mode: 'Land' },
  { name: 'Hand Carry Service', basis: 'shipment', mode: 'Hand Carry' },
  { name: 'Special Handling', basis: 'shipment', mode: 'Others' }
];

export const DEFAULT_SERVICES: Record<Mode, string[]> = {
  Air: [
    'Origin Charges',
    'Airfreight',
    'Fuel Surcharge',
    'Security Surcharge',
    'Export Customs',
    'Import Customs',
    'Transportation'
  ],
  Sea: ['Ocean Freight', 'Origin Terminal Handling', 'Destination Port Clearance', 'On-carriage'],
  Land: ['Road Freight', 'Export Customs', 'Import Customs'],
  Courier: ['Courier Service', 'Fuel Surcharge', 'Import Customs'],
  'Hand Carry': ['Hand Carry Service', 'Import Customs'],
  Others: ['Special Handling']
};

export function serviceBasis(name: string): Basis {
  return SERVICES.find((s) => s.name === name)?.basis ?? 'shipment';
}

export const INCOTERMS: { code: string; text: string }[] = [
  { code: 'EXW', text: 'Ex Works. The buyer takes on all costs and risks from the seller premises.' },
  { code: 'FCA', text: 'Free Carrier. The seller delivers the goods to the carrier named by the buyer, cleared for export.' },
  { code: 'FOB', text: 'Free On Board. The seller delivers the goods on board the vessel at the port of origin.' },
  { code: 'CFR', text: 'Cost and Freight. The seller pays freight to the port of destination. Risk passes when goods are on board.' },
  { code: 'CIF', text: 'Cost, Insurance and Freight. Like CFR, and the seller also arranges minimum insurance.' },
  { code: 'CPT', text: 'Carriage Paid To. The seller pays carriage to the named destination.' },
  { code: 'CIP', text: 'Carriage and Insurance Paid To. Like CPT, and the seller also arranges insurance.' },
  { code: 'DAP', text: 'Delivered At Place. The seller bears all costs and risks until arrival at the named destination, excluding unloading and import clearance.' },
  { code: 'DPU', text: 'Delivered at Place Unloaded. The seller delivers and unloads at the named destination.' },
  { code: 'DDP', text: 'Delivered Duty Paid. The seller bears all costs and risks to the destination, including import duties.' }
];

export const JOB_TYPES = [
  'Supplier to WH Destination',
  'Supplier to Customer',
  'WH to Customer',
  'Origin to Destination'
];

export const SERVICE_TYPES = ['Direct', 'Consolidation'];

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  Air: 'Fast delivery for urgent and high value cargo',
  Sea: 'Cost effective for large and heavy shipments',
  Land: 'Road transport between cities and countries',
  Courier: 'Small parcels and documents door to door',
  'Hand Carry': 'Personally carried, time critical items',
  Others: 'Special services that do not fit the other modes'
};
