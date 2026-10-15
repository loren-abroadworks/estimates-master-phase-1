

import {
  WorkOrder, Estimate, Invoice, Job, Lead, Client, Appointment, CrewMember,
  PaintColorEntry, EstimateArea, MiscLineItem, UnitType, WeatherKind
} from '../types';
import { ensureJobAllocations } from '../services/shifts';
import { 
  Home, Paintbrush, Shield, Clock, Users, Star, 
  MapPin, Phone, Mail, Calendar, CheckCircle2, 
  AlertCircle, FileText, ArrowRight 
} from 'lucide-react';

// --- MOCK SALESMEN / CREW ---
export const MOCK_SALESMEN: CrewMember[] = [
  { id: 's1', name: 'Mike Smith', role: 'Owner', email: 'mike@precisionpaint.com', phone: '(555) 123-4567', photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike', status: 'Active' },
  { id: 's2', name: 'Jessica Miller', role: 'Estimator', email: 'jessica@precisionpaint.com', phone: '(555) 987-6543', photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jessica', status: 'Active' },
  { id: 's3', name: 'David Chen', role: 'Estimator', email: 'david@precisionpaint.com', phone: '(555) 456-7890', photo: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David', status: 'Active' }
];

// --- ESTIMATE TEMPLATES ---
export const ESTIMATE_TEMPLATES: Record<string, any> = {
  'temp-int-1': {
    id: 'temp-int-1',
    projectName: 'Standard Interior Repaint',
    status: 'Draft',
    scopeId: 'scope-int',
    customer: {
      id: '1', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567',
      billingAddress: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001'
    },
    jobAddress: {
      address: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001', accessCode: ''
    },
    projectInfo: {
      name: 'Standard Interior Repaint', number: 'EST-2024-001', date: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
    },
    salesman: MOCK_SALESMEN[0],
    estimateAreas: [
      {
        id: 'area-1',
        name: 'Living Room',
        length: 15, width: 12, height: 9,
        rows: [
          { id: 'r1', item: 'Standard 8ft Walls', productionRateId: 'pr-1', unit: 'SqFt', amount: 486, coats: 2, hours: 3.24, colorNum: '1', customValues: { 'col-prep': 1, 'col-wash': false }, isOptional: false },
          { id: 'r2', item: 'Flat Ceilings', productionRateId: 'pr-2', unit: 'SqFt', amount: 180, coats: 2, hours: 1.5, colorNum: '2', customValues: {}, isOptional: false },
          { id: 'r3', item: 'Baseboards (Standard 4")', productionRateId: 'pr-3', unit: 'LnFt', amount: 54, coats: 2, hours: 0.68, colorNum: '3', customValues: {}, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      }
    ],
    lineItems: {
      'misc-1': { id: 'misc-1', itemType: 'descriptive', description: 'Setup & Protection', details: 'Cover all floors and furniture with plastic/drop cloths.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-1', 'misc-1'],
    paintColors: [
      { id: 'pc-1', colorCode: '1', colorName: 'Agreeable Gray', brand: 'Sherwin-Williams', productId: 'mat-p1', finish: 'Velvet', area: '', surfaces: [] },
      { id: 'pc-2', colorCode: '2', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p2', finish: 'Flat', area: '', surfaces: [] },
      { id: 'pc-3', colorCode: '3', colorName: 'Extra White', brand: 'Sherwin-Williams', productId: 'mat-p4', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    sundries: [
      { id: 'sun-1', name: 'Blue Painter\'s Tape (1.5")', count: 3, unitPrice: 8.50, total: 25.50 },
      { id: 'sun-2', name: 'Contractor Plastic (9x400)', count: 1, unitPrice: 42.00, total: 42.00 },
      { id: 'sun-3', name: 'Painter\'s Caulk (White)', count: 4, unitPrice: 3.50, total: 14.00 },
      { id: 'sun-4', name: 'Sanding Sponges (Medium)', count: 1, unitPrice: 5.99, total: 5.99 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 },
    finalize: { deposit: '25% due upon scheduling.', terms: 'Standard residential terms apply.' }
  },
  'temp-ext-1': {
    id: 'temp-ext-1',
    projectName: 'Full Exterior Repaint',
    description: 'Siding, Trim, and Doors for 2-story home.',
    scopeId: 'scope-ext',
    estimateAreas: [
        {
            id: 'area-ext-1',
            name: 'Front Elevation',
            length: 40, width: 0, height: 20,
            rows: [
                { id: 'r-ext-1', item: 'Pressure Wash', productionRateId: 'pr-ext-wash', unit: 'SqFt', amount: 800, coats: 1, hours: 2.6, colorNum: '', customValues: { 'col-wash': true }, isOptional: false },
                { id: 'r-ext-2', item: 'Exterior Siding', productionRateId: 'pr-ext-siding', unit: 'SqFt', amount: 800, coats: 2, hours: 8.0, colorNum: '1', customValues: { 'col-prep': 2, 'col-coat1': 800, 'col-coat2': 800 }, isOptional: false },
                { id: 'r-ext-3', item: 'Fascia & Trim', productionRateId: 'pr-ext-fascia', unit: 'LnFt', amount: 60, coats: 2, hours: 2.0, colorNum: '1', customValues: { 'col-coat1': 60, 'col-coat2': 60 }, isOptional: false },
                { id: 'r-ext-4', item: 'Front Entry Door', productionRateId: 'pr-ext-door', unit: 'Item', amount: 1, coats: 2, hours: 1.5, colorNum: '2', customValues: { 'col-coat1': 1, 'col-coat2': 1 }, isOptional: false }
            ],
            isOptional: false,
            visibility: {}
        },
        {
            id: 'area-ext-2',
            name: 'Left Elevation',
            length: 30, width: 0, height: 20,
            rows: [
                { id: 'r-ext-5', item: 'Exterior Siding', productionRateId: 'pr-ext-siding', unit: 'SqFt', amount: 600, coats: 2, hours: 6.0, colorNum: '1', customValues: { 'col-coat1': 600, 'col-coat2': 600 }, isOptional: false },
                { id: 'r-ext-6', item: 'Soffits', productionRateId: 'pr-ext-soffit', unit: 'SqFt', amount: 60, coats: 2, hours: 1.2, colorNum: '1', customValues: { 'col-coat1': 60, 'col-coat2': 60 }, isOptional: false }
            ],
            isOptional: false,
            visibility: {}
        }
    ],
    lineItems: {
        'misc-ext-1': { id: 'misc-ext-1', itemType: 'descriptive', description: 'Power Washing', details: 'Full house wash with mildewcide treatment prior to painting.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-ext-1', 'area-ext-2', 'misc-ext-1'],
    paintColors: [
        { id: 'pc-ext-1', colorCode: '1', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Satin', area: '', surfaces: [] },
        { id: 'pc-ext-2', colorCode: '2', colorName: 'Tricorn Black', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    sundries: [
        { id: 'sun-ext-1', name: 'Masking Paper (12 inch)', count: 6, unitPrice: 4.25, total: 25.50 },
        { id: 'sun-ext-2', name: 'Heavy Duty Trash Bags', count: 1, unitPrice: 15.00, total: 15.00 },
        { id: 'sun-ext-3', name: 'Painter\'s Caulk (Exterior)', count: 8, unitPrice: 4.50, total: 36.00 },
        { id: 'sun-ext-4', name: 'Blue Painter\'s Tape (1.5")', count: 4, unitPrice: 8.50, total: 34.00 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 },
    finalize: { deposit: '30% due upon scheduling.', terms: 'Standard exterior terms apply.' }
  },
  'temp-ext-sample': {
    id: 'temp-ext-sample',
    projectName: 'Exterior Repaint (Sample)',
    description: 'Based on user screenshot: Fascia, Soffits, Siding, Doors.',
    scopeId: 'scope-ext',
    estimateAreas: [
        {
            id: 'area-sample-1',
            name: 'Front/South',
            length: 40, width: 0, height: 18,
            rows: [
                { id: 'r-sample-1', item: 'Fascia', productionRateId: 'pr-ext-fascia', unit: 'LnFt', amount: 40, coats: 2, hours: 1.2, colorNum: '2', customValues: { 'col-coat1': 40, 'col-coat2': 40, 'col-prep': 0.5, 'col-caulk': 1, 'col-wash': false }, isOptional: false, isHoursOverridden: true },
                { id: 'r-sample-2', item: 'Soffits', productionRateId: 'pr-ext-soffit', unit: 'SqFt', amount: 80, coats: 2, hours: 2.83, colorNum: '2', customValues: { 'col-coat1': 80, 'col-coat2': 80, 'col-prep': 0.5, 'col-wash': false }, isOptional: false, isHoursOverridden: true },
                { id: 'r-sample-3', item: 'Siding', productionRateId: 'pr-ext-siding', unit: 'SqFt', amount: 720, coats: 2, hours: 13.2, colorNum: '1', customValues: { 'col-coat1': 720, 'col-coat2': 720, 'col-prep': 4, 'col-wash': false }, isOptional: false, isHoursOverridden: true },
                { id: 'r-sample-4', item: 'Doors', productionRateId: 'pr-ext-door', unit: 'Item', amount: 1, coats: 2, hours: 1.17, colorNum: '3', customValues: { 'col-coat1': 1, 'col-coat2': 1, 'col-prep': 0, 'col-wash': false }, isOptional: false, isHoursOverridden: true },
                { id: 'r-sample-5', item: 'Pressure Wash', productionRateId: 'pr-ext-wash', unit: 'SqFt', amount: 0, coats: 0, hours: 0, colorNum: '', customValues: { 'col-coat1': 0, 'col-coat2': 0, 'col-prep': 0, 'col-wash': false }, isOptional: false }
            ],
            isOptional: false,
            visibility: {}
        }
    ],
    lineItems: {
        'misc-sample-1': { id: 'misc-sample-1', itemType: 'descriptive', description: 'Project Scope', details: 'Full exterior repaint including prep, wash, and finishing of all listed surfaces.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-sample-1', 'misc-sample-1'],
    paintColors: [
        { id: 'pc-sample-1', colorCode: '1', colorName: 'Body Color', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Satin', area: 'Siding', surfaces: [] },
        { id: 'pc-sample-2', colorCode: '2', colorName: 'Trim Color', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Gloss', area: 'Fascia/Soffit', surfaces: [] },
        { id: 'pc-sample-3', colorCode: '3', colorName: 'Accent Color', brand: 'Sherwin-Williams', productId: 'mat-p2', finish: 'Semi-Gloss', area: 'Doors', surfaces: [] }
    ],
    sundries: [
        { id: 'sun-sample-1', name: 'Exterior Caulk', count: 12, unitPrice: 4.50, total: 54.00 },
        { id: 'sun-sample-2', name: 'Masking Plastic', count: 2, unitPrice: 42.00, total: 84.00 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 },
    finalize: { deposit: '30% due upon scheduling.', terms: 'Standard exterior terms apply.' }
  },
  'temp-cab-1': {
    id: 'temp-cab-1',
    projectName: 'Kitchen Cabinet Refinish',
    description: 'Factory finish for kitchen cabinets.',
    scopeId: 'scope-int',
    estimateAreas: [
      {
        id: 'area-cab-1',
        name: 'Kitchen Cabinets',
        length: 0, width: 0, height: 0,
        rows: [
          { id: 'r-cab-1', item: 'Upper Cabinets', productionRateId: 'pr-7', unit: 'Item', amount: 15, coats: 2, hours: 7.5, colorNum: '1', customValues: {}, isOptional: false },
          { id: 'r-cab-2', item: 'Lower Cabinets', productionRateId: 'pr-7', unit: 'Item', amount: 12, coats: 2, hours: 6.0, colorNum: '1', customValues: {}, isOptional: false },
          { id: 'r-cab-3', item: 'Drawers', productionRateId: 'pr-7', unit: 'Item', amount: 8, coats: 2, hours: 4.0, colorNum: '1', customValues: {}, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      }
    ],
    lineItems: {
        'misc-cab-1': { id: 'misc-cab-1', itemType: 'descriptive', description: 'Protection', details: 'Full masking of kitchen, countertops, and appliances.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-cab-1', 'misc-cab-1'],
    paintColors: [
        { id: 'pc-cab-1', colorCode: '1', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p2', finish: 'Satin', area: '', surfaces: [] }
    ],
    sundries: [
        { id: 'sun-cab-1', name: 'Contractor Plastic (9x400)', count: 2, unitPrice: 42.00, total: 84.00 },
        { id: 'sun-cab-2', name: 'Blue Painter\'s Tape (1.5")', count: 5, unitPrice: 8.50, total: 42.50 },
        { id: 'sun-cab-3', name: 'Sanding Sponges (Fine)', count: 3, unitPrice: 5.99, total: 17.97 },
        { id: 'sun-cab-4', name: 'Rags (Box of 50)', count: 1, unitPrice: 12.00, total: 12.00 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 },
    finalize: { deposit: '50% due upon scheduling.', terms: 'Cabinet refinishing terms apply.' }
  },
  'temp-deck-1': {
    id: 'temp-deck-1',
    projectName: 'Deck Staining',
    description: 'Power wash, sand, and stain deck.',
    scopeId: 'scope-ext',
    estimateAreas: [
      {
        id: 'area-deck-1',
        name: 'Back Deck',
        length: 20, width: 15, height: 0,
        rows: [
          { id: 'r-deck-1', item: 'Deck Floor', productionRateId: 'pr-ext-siding', unit: 'SqFt', amount: 300, coats: 2, hours: 6.0, colorNum: '1', customValues: { 'col-wash': true, 'col-prep': 3 }, isOptional: false },
          { id: 'r-deck-2', item: 'Railings', productionRateId: 'pr-ext-fascia', unit: 'LnFt', amount: 50, coats: 2, hours: 3.5, colorNum: '1', customValues: { 'col-wash': true }, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      }
    ],
    lineItems: {},
    formLayout: ['area-deck-1'],
    paintColors: [
        { id: 'pc-deck-1', colorCode: '1', colorName: 'Woodridge', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Transparent', area: '', surfaces: [] }
    ],
    sundries: [
        { id: 'sun-deck-1', name: 'Roller Covers (3/4 Nap)', count: 4, unitPrice: 6.50, total: 26.00 },
        { id: 'sun-deck-2', name: 'Plastic Drop Cloths', count: 2, unitPrice: 3.50, total: 7.00 },
        { id: 'sun-deck-3', name: 'Deck Cleaner', count: 2, unitPrice: 18.00, total: 36.00 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 0, baseTaxAmount: 0, baseDiscountAmount: 0 },
    finalize: { deposit: '30% due upon scheduling.', terms: 'Standard exterior terms apply.' }
  }
};

// --- CLIENT PREVIEW MOCK DATA ---
export const SERVICES = [
    { title: "Interior Painting", desc: "Flawless finishes for walls, ceilings, and trim using premium paints.", icon: Paintbrush },
    { title: "Cabinet Refinishing", desc: "Factory-like finish for your kitchen and bathroom cabinets.", icon: Home },
    { title: "Exterior Painting", desc: "Long-lasting protection and curb appeal for your home's exterior.", icon: Shield },
    { title: "Deck Staining", desc: "Restore and protect your deck with high-quality stains and sealers.", icon: Users }, // Using Users as placeholder icon
];

export const PORTFOLIO_ITEMS = [
    { id: 1, title: "Modern Farmhouse Interior", category: "Interior", image: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800" },
    { id: 2, title: "Victorian Exterior Restoration", category: "Exterior", image: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&q=80&w=800" },
    { id: 3, title: "Kitchen Cabinet Transformation", category: "Cabinets", image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800" },
    { id: 4, title: "Luxury Master Suite", category: "Interior", image: "https://images.unsplash.com/photo-1616594039964-40891a909d72?auto=format&fit=crop&q=80&w=800" },
];

export const REVIEWS = [
    { id: 1, author: "Sarah Jenkins", role: "Homeowner", text: "Absolutely thrilled with the results! The team was professional, punctual, and their attention to detail was impeccable.", rating: 5 },
    { id: 2, author: "Michael Thompson", role: "Property Manager", text: "Precision Paintworks is my go-to for all my rental properties. Reliable, fair pricing, and excellent quality every time.", rating: 5 },
    { id: 3, author: "Emily Rodriguez", role: "Interior Designer", text: "As a designer, I'm very picky about finishes. This crew exceeded my expectations. Highly recommend!", rating: 5 },
];

// --- MOCK CLIENTS ---
export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.j@email.com',
    phone: '(555) 123-4567',
    address: '123 Creative Blvd, Art Town, NY 10001',
    properties: [
      { id: 'p1', address: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001' },
      { id: 'p2', address: '789 Vacation Way', city: 'Beach City', state: 'FL', zip: '33139' }
    ],
    starred: true,
    qualityRating: 5,
    notes: 'Prefers email communication. Has a dog named Buster.'
  },
  {
    id: '2',
    name: 'David Lee',
    firstName: 'David',
    lastName: 'Lee',
    email: 'david.lee@techcorp.com',
    phone: '(555) 987-6543',
    address: '456 Tech Park, Innovation City, CA 94000',
    properties: [
      { id: 'p3', address: '456 Tech Park', city: 'Innovation City', state: 'CA', zip: '94000' }
    ],
    starred: false,
    qualityRating: 4
  },
  {
    id: '3',
    name: 'Emily Davis',
    firstName: 'Emily',
    lastName: 'Davis',
    email: 'emily.d@designstudio.net',
    phone: '(555) 456-7890',
    address: '321 Design St, Styleville, NY 10002',
    properties: [
      { id: 'p4', address: '321 Design St', city: 'Styleville', state: 'NY', zip: '10002' },
      { id: 'p5', address: '888 Studio Ave', city: 'Styleville', state: 'NY', zip: '10002' }
    ],
    starred: true,
    qualityRating: 5
  },
  {
      id: '4',
      name: 'Alice Cooper',
      firstName: 'Alice',
      lastName: 'Cooper',
      email: 'alice.c@example.com',
      phone: '(555) 777-8888',
      address: '222 Birch Ln, Decatur, IL 62521',
      properties: [
          { id: 'p6', address: '222 Birch Ln', city: 'Decatur', state: 'IL', zip: '62521' }
      ],
      starred: false,
      qualityRating: 0
  }
];

// --- MOCK LEADS ---
export const MOCK_LEADS: Lead[] = [
  {
    id: 'lead-1',
    date: new Date().toISOString(),
    firstName: 'John',
    lastName: 'Doe',
    phone: '(555) 111-2222',
    email: 'john.doe@example.com',
    source: 'Website',
    address: '555 Maple Ave',
    city: 'Springfield',
    state: 'IL',
    zip: '62704',
    status: 'New',
    generatedJobId: 'JOB-2024-LEAD-001',
    qualityRating: 0
  },
  {
    id: 'lead-2',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '(555) 333-4444',
    email: 'jane.smith@example.com',
    source: 'Referral',
    address: '777 Oak Ln',
    city: 'Shelbyville',
    state: 'IL',
    zip: '62565',
    status: 'Contacted',
    generatedJobId: 'JOB-2024-LEAD-002',
    qualityRating: 3
  },
  {
    id: 'lead-3',
    date: new Date(Date.now() - 86400000 * 5).toISOString(),
    firstName: 'Robert',
    lastName: 'Brown',
    phone: '(555) 555-6666',
    email: 'rob.brown@example.com',
    source: 'Google',
    address: '101 Pine St',
    city: 'Capital City',
    state: 'IL',
    zip: '62701',
    status: 'Scheduled',
    generatedJobId: 'JOB-2024-LEAD-003',
    qualityRating: 4
  },
  {
    id: 'lead-4',
    date: new Date(Date.now() - 86400000 * 1).toISOString(),
    firstName: 'Alice',
    lastName: 'Cooper',
    phone: '(555) 777-8888',
    email: 'alice.c@example.com',
    source: 'Facebook',
    address: '222 Birch Ln',
    city: 'Decatur',
    state: 'IL',
    zip: '62521',
    status: 'Sold', // Now Sold
    generatedJobId: 'JOB-2024-LEAD-004',
    qualityRating: 5,
    clientId: '4' // Linked to client 4
  },
  {
    id: 'lead-5',
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    firstName: 'Tom',
    lastName: 'Hanks',
    phone: '(555) 444-9999',
    email: 'tom.h@example.com',
    source: 'Referral',
    address: '333 Elm St',
    city: 'Lincoln',
    state: 'IL',
    zip: '62656',
    status: 'Contacted',
    generatedJobId: 'JOB-2024-LEAD-005',
    qualityRating: 2
  }
];

// --- MOCK WORK ORDERS ---
export const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-2',
    estimateId: 'est-2',
    clientId: '2',
    version: 1,
    status: 'In Progress',
    jobName: 'Exterior Repaint',
    customerName: 'David Lee',
    customerPhone: '(555) 987-6543',
    customerEmail: 'david.lee@techcorp.com',
    jobAddress: '456 Tech Park, Innovation City, CA 94000',
    accessCode: '1234',
    startDate: new Date(Date.now() - 86400000).toISOString(),
    endDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    crewLeaderId: 'cm-6',
    crewMemberIds: ['cm-6', 'cm-3', 'cm-4'],
    totalProductionHours: 85.0,
    tasks: [
        { id: 'wo-ext-1', areaName: 'Exterior', description: 'Pressure Wash', quantity: 2500, uom: 'SqFt', coats: 1, estimatedHours: 8.0, actualHours: 8.0, prepWash: true, prepScrape: false, prepCaulk: false, prepPrime: false, paintColorCode: '', paintProduct: 'Cleaner', paintSheen: '' },
        { id: 'wo-ext-2', areaName: 'Exterior', description: 'Scrape & Prime', quantity: 500, uom: 'SqFt', coats: 1, estimatedHours: 15.0, actualHours: 12.0, prepWash: false, prepScrape: true, prepCaulk: false, prepPrime: true, paintColorCode: '', paintProduct: 'Oil Primer', paintSheen: '' },
        { id: 'wo-ext-3', areaName: 'Exterior', description: 'Siding Repaint', quantity: 2500, uom: 'SqFt', coats: 2, estimatedHours: 35.0, actualHours: 30.0, prepWash: false, prepScrape: false, prepCaulk: true, prepPrime: false, paintColorCode: '1', paintProduct: 'Emerald Exterior', paintSheen: 'Satin' },
        { id: 'wo-ext-4', areaName: 'Exterior', description: 'Trim & Fascia', quantity: 450, uom: 'LnFt', coats: 2, estimatedHours: 20.0, actualHours: 0, prepWash: false, prepScrape: false, prepCaulk: true, prepPrime: false, paintColorCode: '1', paintProduct: 'Emerald Exterior', paintSheen: 'Satin' },
        { id: 'wo-ext-5', areaName: 'Front Porch', description: 'Door & Railings', quantity: 1, uom: 'Item', coats: 2, estimatedHours: 7.0, actualHours: 0, prepWash: false, prepScrape: true, prepCaulk: true, prepPrime: false, paintColorCode: '2', paintProduct: 'Emerald Urethane', paintSheen: 'Semi-Gloss' }
    ], 
    paintSchedule: [
        { id: 'pc-ext-1', colorCode: '1', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Satin', area: '', surfaces: [] },
        { id: 'pc-ext-2', colorCode: '2', colorName: 'Tricorn Black', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    areasExcluded: 'Rear deck, fence',
    existingConditions: 'Peeling paint on south side, some wood rot on fascia',
    toolsNeeded: '32ft Extension ladder, Pressure washer',
    materialsNeeded: 'Masking paper, exterior caulk',
    fieldNotes: 'Gate code is 1234. Watch out for sprinklers.',
    notes: [
      { id: 'note-1', author: 'Mike Smith', text: 'Gate code is 1234. Watch out for sprinklers.', date: 'Jan 10, 2024' }
    ]
  },
  {
    id: 'wo-3',
    estimateId: 'est-3',
    clientId: '3',
    version: 1,
    status: 'Scheduled', 
    jobName: 'Deck Staining',
    customerName: 'Emily Davis',
    customerPhone: '(555) 456-7890',
    customerEmail: 'emily.d@designstudio.net',
    jobAddress: '321 Design St, Styleville, NY 10002',
    accessCode: '',
    startDate: '', 
    endDate: '',
    crewLeaderId: null,
    crewMemberIds: [],
    totalProductionHours: 12.0,
    tasks: [
        {
            id: 'task-deck-1',
            areaName: 'Back Deck',
            description: 'Wash & Sand',
            quantity: 400,
            uom: 'SqFt',
            coats: 0,
            estimatedHours: 4.0,
            actualHours: 0,
            prepWash: true,
            prepScrape: true,
            prepCaulk: false,
            prepPrime: false,
            paintColorCode: '',
            paintProduct: 'Deck Cleaner',
            paintSheen: ''
        },
        {
            id: 'task-deck-2',
            areaName: 'Back Deck',
            description: 'Stain Application',
            quantity: 400,
            uom: 'SqFt',
            coats: 2,
            estimatedHours: 8.0,
            actualHours: 0,
            prepWash: false,
            prepScrape: false,
            prepCaulk: false,
            prepPrime: false,
            paintColorCode: '1',
            paintProduct: 'WoodScapes',
            paintSheen: 'Semi-Transparent'
        }
    ],
    paintSchedule: [
        { id: 'pc-deck-1', colorCode: '1', colorName: 'Woodridge', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Transparent', area: '', surfaces: [] }
    ],
    areasExcluded: 'Patio furniture',
    existingConditions: 'Weathered wood',
    toolsNeeded: 'Power washer, Sander',
    materialsNeeded: 'Stain, Plastic',
    fieldNotes: 'Gate is unlocked.',
    notes: [
      { id: 'note-2', author: 'Jessica Miller', text: 'Gate is unlocked.', date: 'Jan 12, 2024' }
    ]
  },
  {
    id: 'wo-4',
    estimateId: 'est-3',
    clientId: '3',
    version: 1,
    status: 'Scheduled',
    jobName: 'Downtown Commercial',
    customerName: 'Emily Davis',
    customerPhone: '(555) 456-7890',
    customerEmail: 'emily.d@designstudio.net',
    jobAddress: '101 Pine St, Styleville, NY 10002',
    accessCode: '',
    startDate: '',
    endDate: '',
    crewLeaderId: 'cm-1',
    crewMemberIds: ['cm-1', 'cm-4', 'cm-6', 'cm-2'],
    // 4-day, multi-crew commercial repaint — sized so a fully-staffed crew
    // (4 painters x 4 days x 9h = 144h) stays under budget.
    totalProductionHours: 150.0,
    tasks: [
        { id: 'wo-dt-1', areaName: 'Whole Floor', description: 'Surface Prep & Masking', quantity: 6000, uom: 'SqFt', coats: 0, estimatedHours: 24.0, actualHours: 0, prepWash: true, prepScrape: true, prepCaulk: false, prepPrime: false, paintColorCode: '', paintProduct: 'Masking', paintSheen: '' },
        { id: 'wo-dt-2', areaName: 'Whole Floor', description: 'Drywall Patch & Sand', quantity: 120, uom: 'Item', coats: 0, estimatedHours: 18.0, actualHours: 0, prepWash: false, prepScrape: true, prepCaulk: true, prepPrime: false, paintColorCode: '', paintProduct: 'Joint Compound', paintSheen: '' },
        { id: 'wo-dt-3', areaName: 'Walls', description: 'Prime Walls', quantity: 6000, uom: 'SqFt', coats: 1, estimatedHours: 36.0, actualHours: 0, prepWash: false, prepScrape: false, prepCaulk: false, prepPrime: true, paintColorCode: '1', paintProduct: 'ProMar 200 Primer', paintSheen: 'Flat' },
        { id: 'wo-dt-4', areaName: 'Walls', description: 'Finish Coat Walls', quantity: 6000, uom: 'SqFt', coats: 2, estimatedHours: 52.0, actualHours: 0, prepWash: false, prepScrape: false, prepCaulk: false, prepPrime: false, paintColorCode: '1', paintProduct: 'ProMar 200', paintSheen: 'Eggshell' },
        { id: 'wo-dt-5', areaName: 'Ceilings & Trim', description: 'Ceilings & Trim', quantity: 6000, uom: 'SqFt', coats: 2, estimatedHours: 20.0, actualHours: 0, prepWash: false, prepScrape: false, prepCaulk: true, prepPrime: false, paintColorCode: '2', paintProduct: 'ProMar 200', paintSheen: 'Semi-Gloss' }
    ],
    paintSchedule: [
        { id: 'pc-dt-1', colorCode: '1', colorName: 'Agreeable Gray', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Eggshell', area: '', surfaces: [] },
        { id: 'pc-dt-2', colorCode: '2', colorName: 'Extra White', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    areasExcluded: 'Elevator lobby, restrooms',
    existingConditions: 'Scuffed walls, minor drywall damage throughout',
    toolsNeeded: 'Airless sprayer, scaffolding, drop cloths',
    materialsNeeded: 'Masking film, joint compound, primer',
    fieldNotes: 'After-hours access only; loading dock on Pine St.',
    notes: [
      { id: 'note-3', author: 'Mike Smith', text: 'After-hours access only; loading dock on Pine St.', date: 'Jan 14, 2024' }
    ]
  }
];

// --- MOCK INVOICES ---
export const MOCK_INVOICES: Invoice[] = [
  {
    id: 'inv-2',
    number: 'INV-2024-1002',
    createdDate: new Date(Date.now() - 86400000 * 10).toISOString(),
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString(), // Due in 2 days
    estimateId: 'est-2',
    workOrderId: 'wo-2',
    clientId: '2',
    clientName: 'David Lee',
    clientEmail: 'david.lee@techcorp.com',
    clientPhone: '(555) 987-6543',
    projectName: 'Exterior Repaint',
    jobAddress: '456 Tech Park, Innovation City, CA 94000',
    subtotal: 8500,
    taxAmount: 0,
    totalAmount: 8500,
    depositRequired: 2550,
    depositPaid: true,
    amountPaid: 2550,
    balanceDue: 5950,
    status: 'Partially Paid',
    payments: [],
    items: [
        { id: 'inv-ext-1', areaName: 'Exterior', description: 'Power Wash & Prep', quantity: 2500, unit: 'SqFt', coats: 1, product: 'Cleaning Solution', productDetails: 'Concentrate', unitPrice: 0.34, amount: 850 },
        { id: 'inv-ext-2', areaName: 'Exterior', description: 'Siding Repaint', quantity: 2500, unit: 'SqFt', coats: 2, product: 'Emerald Exterior', productDetails: 'Satin • 1', unitPrice: 2.20, amount: 5500 },
        { id: 'inv-ext-3', areaName: 'Exterior', description: 'Trim & Soffits', quantity: 450, unit: 'LnFt', coats: 2, product: 'Emerald Exterior', productDetails: 'Satin • 1', unitPrice: 3.66, amount: 1650 },
        { id: 'inv-ext-4', areaName: 'Front Entry', description: 'Door Refinishing', quantity: 1, unit: 'Item', coats: 2, product: 'Emerald Urethane', productDetails: 'Semi-Gloss • 2', unitPrice: 500, amount: 500 }
    ],
    files: []
  },
  {
    id: 'inv-3',
    number: 'INV-2024-1003',
    createdDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), // Due in 5 days
    estimateId: 'est-3',
    workOrderId: 'wo-3',
    clientId: '3',
    clientName: 'Emily Davis',
    clientEmail: 'emily.d@designstudio.net',
    clientPhone: '(555) 456-7890',
    projectName: 'Deck Staining',
    jobAddress: '321 Design St, Styleville, NY 10002',
    subtotal: 2400,
    taxAmount: 0,
    totalAmount: 2400,
    depositRequired: 720,
    depositPaid: true,
    amountPaid: 720,
    balanceDue: 1680,
    status: 'Partially Paid',
    payments: [
      { id: 'pay-2', date: new Date().toISOString(), amount: 720, method: 'Check', reference: '101', recordedBy: 'System' }
    ],
    items: [
        { id: 'inv-deck-1', areaName: 'Back Deck', description: 'Stain & Seal', quantity: 400, unit: 'SqFt', coats: 2, product: 'WoodScapes', productDetails: 'Semi-Transparent', unitPrice: 6.00, amount: 2400 }
    ],
    files: []
  },
  {
      id: 'inv-4',
      number: 'INV-2024-0998',
      createdDate: new Date(Date.now() - 86400000 * 25).toISOString(),
      dueDate: new Date(Date.now() - 86400000 * 5).toISOString(), // Overdue 5 days
      estimateId: 'est-5', // Alice Cooper
      clientId: '4',
      clientName: 'Alice Cooper',
      clientEmail: 'alice.c@example.com',
      clientPhone: '(555) 777-8888',
      projectName: 'Whole House Interior',
      jobAddress: '222 Birch Ln, Decatur, IL 62521',
      subtotal: 12500,
      taxAmount: 0,
      totalAmount: 12500,
      depositRequired: 2500,
      depositPaid: true,
      amountPaid: 2500,
      balanceDue: 10000,
      status: 'Overdue',
      payments: [{ id: 'pay-x', date: new Date(Date.now() - 86400000 * 24).toISOString(), amount: 2500, method: 'Check', reference: '1001', recordedBy: 'System' }],
      items: [{ description: 'Interior Painting', amount: 12500, quantity: 1, unit: 'Lot' }]
  },
  {
      id: 'inv-5',
      number: 'INV-2024-1005',
      createdDate: new Date(Date.now() - 86400000 * 2).toISOString(),
      dueDate: new Date(Date.now() + 12 * 86400000).toISOString(), // Due 12 days
      estimateId: 'est-1', // Sarah Johnson
      clientId: '1',
      clientName: 'Sarah Johnson',
      clientEmail: 'sarah.j@email.com',
      clientPhone: '(555) 123-4567',
      projectName: 'Kitchen Refresh',
      jobAddress: '123 Creative Blvd, Art Town, NY 10001',
      subtotal: 3500,
      taxAmount: 0,
      totalAmount: 3500,
      depositRequired: 875,
      depositPaid: false,
      amountPaid: 0,
      balanceDue: 3500,
      status: 'Sent',
      payments: [],
      items: [{ description: 'Kitchen Cabinet Refinish', amount: 3500, quantity: 1, unit: 'Lot' }]
  }
];

// --- MOCK ESTIMATES ---
// Authored in the legacy (pre-packages) shape; App.tsx runs migrateEstimate() on load
// to wrap each into a single package. Typed loosely so the legacy literals are accepted.
export const MOCK_ESTIMATES: any[] = [
  {
    id: 'est-1',
    projectName: 'Smith Living Room',
    status: 'Approved',
    scopeId: 'scope-int',
    customer: {
      id: '1', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567',
      billingAddress: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001'
    },
    jobAddress: {
      address: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001', accessCode: ''
    },
    projectInfo: {
      name: 'Smith Living Room', number: 'EST-2024-001', date: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
    },
    salesman: MOCK_SALESMEN[0],
    estimateAreas: [
      {
        id: 'area-1',
        name: 'Living Room',
        length: 15, width: 12, height: 9,
        rows: [
          { id: 'r1', item: 'Standard 8ft Walls', productionRateId: 'pr-1', unit: UnitType.SQFT, amount: 486, coats: 2, hours: 3.24, colorNum: '1', customValues: { 'col-prep': 1, 'col-wash': false }, isOptional: false },
          { id: 'r2', item: 'Flat Ceilings', productionRateId: 'pr-2', unit: UnitType.SQFT, amount: 180, coats: 2, hours: 1.5, colorNum: '2', customValues: {}, isOptional: true },
          { id: 'r3', item: 'Baseboards (Standard 4")', productionRateId: 'pr-3', unit: UnitType.LNFT, amount: 54, coats: 2, hours: 0.68, colorNum: '3', customValues: {}, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      },
      {
        id: 'area-2',
        name: 'Guest Bedroom',
        length: 12, width: 10, height: 9,
        rows: [
          { id: 'r4', item: 'Standard 8ft Walls', productionRateId: 'pr-1', unit: UnitType.SQFT, amount: 396, coats: 2, hours: 2.64, colorNum: '1', customValues: { 'col-prep': 1, 'col-wash': false }, isOptional: false }
        ],
        isOptional: true,
        visibility: {}
      }
    ],
    lineItems: {
      'misc-1': { id: 'misc-1', itemType: 'descriptive', description: 'Setup & Protection', details: 'Cover all floors and furniture with plastic/drop cloths.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-1', 'area-2', 'misc-1'],
    paintColors: [
      { id: 'pc-1', colorCode: '1', colorName: 'Agreeable Gray', brand: 'Sherwin-Williams', productId: 'mat-p1', finish: 'Velvet', area: '', surfaces: [] },
      { id: 'pc-2', colorCode: '2', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p2', finish: 'Flat', area: '', surfaces: [] }
    ],
    sundries: [],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 2500, baseTaxAmount: 0, baseDiscountAmount: 0 },
    pricingMethod: 'labor',
    finalize: { deposit: '25%', terms: '' }
  },
  {
    id: 'est-2',
    projectName: 'Exterior Repaint',
    status: 'Sent',
    scopeId: 'scope-ext',
    customer: {
      id: '2', firstName: 'David', lastName: 'Lee', email: 'david.lee@techcorp.com', phone: '(555) 987-6543',
      billingAddress: '456 Tech Park', city: 'Innovation City', state: 'CA', zip: '94000'
    },
    jobAddress: {
      address: '456 Tech Park', city: 'Innovation City', state: 'CA', zip: '94000', accessCode: ''
    },
    projectInfo: {
      name: 'Exterior Repaint', number: 'EST-2024-002', date: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
    },
    salesman: MOCK_SALESMEN[1],
    estimateAreas: [
        {
            id: 'area-ext-1',
            name: 'Front Elevation',
            length: 40, width: 0, height: 20,
            rows: [
                { id: 'r-ext-1', item: 'Pressure Wash', productionRateId: 'pr-ext-wash', unit: UnitType.SQFT, amount: 800, coats: 1, hours: 2.6, colorNum: '', customValues: { 'col-wash': true }, isOptional: false },
                { id: 'r-ext-2', item: 'Exterior Siding', productionRateId: 'pr-ext-siding', unit: UnitType.SQFT, amount: 800, coats: 2, hours: 8.0, colorNum: '1', customValues: { 'col-prep': 2, 'col-coat1': 800, 'col-coat2': 800 }, isOptional: false },
                { id: 'r-ext-3', item: 'Fascia & Trim', productionRateId: 'pr-ext-fascia', unit: UnitType.LNFT, amount: 60, coats: 2, hours: 2.0, colorNum: '1', customValues: { 'col-coat1': 60, 'col-coat2': 60 }, isOptional: false },
                { id: 'r-ext-4', item: 'Front Entry Door', productionRateId: 'pr-ext-door', unit: UnitType.ITEM, amount: 1, coats: 2, hours: 1.5, colorNum: '2', customValues: { 'col-coat1': 1, 'col-coat2': 1 }, isOptional: false }
            ],
            isOptional: false,
            visibility: {}
        }
    ],
    lineItems: {
        'misc-ext-1': { id: 'misc-ext-1', itemType: 'descriptive', description: 'Power Washing', details: 'Full house wash with mildewcide treatment prior to painting.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-ext-1', 'misc-ext-1'],
    paintColors: [
        { id: 'pc-ext-1', colorCode: '1', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Satin', area: '', surfaces: [] },
        { id: 'pc-ext-2', colorCode: '2', colorName: 'Tricorn Black', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    sundries: [
        { id: 'sun-ext-1', name: 'Masking Paper (12 inch)', count: 6, unitPrice: 4.25, total: 25.50 },
        { id: 'sun-ext-2', name: 'Heavy Duty Trash Bags', count: 1, unitPrice: 15.00, total: 15.00 },
        { id: 'sun-ext-3', name: 'Painter\'s Caulk (Exterior)', count: 8, unitPrice: 4.50, total: 36.00 },
        { id: 'sun-ext-4', name: 'Blue Painter\'s Tape (1.5")', count: 4, unitPrice: 8.50, total: 34.00 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 8500, baseTaxAmount: 0, baseDiscountAmount: 0 },
    pricingMethod: 'labor',
    finalize: { deposit: '30%', terms: '' }
  },
  {
    id: 'est-3',
    projectName: 'Deck Staining',
    status: 'Approved',
    scopeId: 'scope-ext',
    customer: {
      id: '3', firstName: 'Emily', lastName: 'Davis', email: 'emily.d@designstudio.net', phone: '(555) 456-7890',
      billingAddress: '321 Design St', city: 'Styleville', state: 'NY', zip: '10002'
    },
    jobAddress: {
      address: '321 Design St', city: 'Styleville', state: 'NY', zip: '10002', accessCode: ''
    },
    projectInfo: {
      name: 'Deck Staining', number: 'EST-2024-003', date: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
    },
    salesman: MOCK_SALESMEN[2], // David Chen
    estimateAreas: [
      {
        id: 'area-deck-1',
        name: 'Back Deck',
        length: 20, width: 15, height: 0,
        rows: [
          { id: 'r-deck-1', item: 'Deck Floor', productionRateId: 'pr-ext-siding', unit: UnitType.SQFT, amount: 300, coats: 2, hours: 6.0, colorNum: '1', customValues: { 'col-wash': true, 'col-prep': 3 }, isOptional: false },
          { id: 'r-deck-2', item: 'Railings', productionRateId: 'pr-ext-fascia', unit: UnitType.LNFT, amount: 50, coats: 2, hours: 3.5, colorNum: '1', customValues: { 'col-wash': true }, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      }
    ],
    lineItems: {},
    formLayout: ['area-deck-1'],
    paintColors: [
        { id: 'pc-deck-1', colorCode: '1', colorName: 'Woodridge', brand: 'Sherwin-Williams', productId: 'mat-p5', finish: 'Semi-Transparent', area: '', surfaces: [] }
    ],
    sundries: [
        { id: 'sun-deck-1', name: 'Roller Covers (3/4 Nap)', count: 4, unitPrice: 6.50, total: 26.00 },
        { id: 'sun-deck-2', name: 'Plastic Drop Cloths', count: 2, unitPrice: 3.50, total: 7.00 },
        { id: 'sun-deck-3', name: 'Deck Cleaner', count: 2, unitPrice: 18.00, total: 36.00 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 2400, baseTaxAmount: 0, baseDiscountAmount: 0 },
    pricingMethod: 'labor',
    finalize: { deposit: '30%', terms: '' }
  },
  {
    id: 'est-4',
    projectName: 'Kitchen Refresh',
    status: 'Sent',
    scopeId: 'scope-int',
    customer: {
      id: '1', firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@email.com', phone: '(555) 123-4567',
      billingAddress: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001'
    },
    jobAddress: {
      address: '123 Creative Blvd', city: 'Art Town', state: 'NY', zip: '10001', accessCode: ''
    },
    projectInfo: {
      name: 'Kitchen Refresh', number: 'EST-2024-004', date: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
    },
    salesman: MOCK_SALESMEN[0],
    estimateAreas: [
      {
        id: 'area-1',
        name: 'Living Room',
        length: 15, width: 12, height: 9,
        rows: [
          { id: 'r1', item: 'Standard 8ft Walls', productionRateId: 'pr-1', unit: UnitType.SQFT, amount: 486, coats: 2, hours: 3.24, colorNum: '1', customValues: { 'col-prep': 1, 'col-wash': false }, isOptional: false },
          { id: 'r2', item: 'Flat Ceilings', productionRateId: 'pr-2', unit: UnitType.SQFT, amount: 180, coats: 2, hours: 1.5, colorNum: '2', customValues: {}, isOptional: false },
          { id: 'r3', item: 'Baseboards (Standard 4")', productionRateId: 'pr-3', unit: UnitType.LNFT, amount: 54, coats: 2, hours: 0.68, colorNum: '3', customValues: {}, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      }
    ],
    lineItems: {
      'misc-1': { id: 'misc-1', itemType: 'descriptive', description: 'Setup & Protection', details: 'Cover all floors and furniture with plastic/drop cloths.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-1', 'misc-1'],
    paintColors: [
      { id: 'pc-1', colorCode: '1', colorName: 'Agreeable Gray', brand: 'Sherwin-Williams', productId: 'mat-p1', finish: 'Velvet', area: '', surfaces: [] },
      { id: 'pc-2', colorCode: '2', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p2', finish: 'Flat', area: '', surfaces: [] },
      { id: 'pc-3', colorCode: '3', colorName: 'Extra White', brand: 'Sherwin-Williams', productId: 'mat-p4', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    sundries: [
      { id: 'sun-1', name: 'Blue Painter\'s Tape (1.5")', count: 3, unitPrice: 8.50, total: 25.50 },
      { id: 'sun-2', name: 'Contractor Plastic (9x400)', count: 1, unitPrice: 42.00, total: 42.00 },
      { id: 'sun-3', name: 'Painter\'s Caulk (White)', count: 4, unitPrice: 3.50, total: 14.00 },
      { id: 'sun-4', name: 'Sanding Sponges (Medium)', count: 1, unitPrice: 5.99, total: 5.99 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 3500, baseTaxAmount: 0, baseDiscountAmount: 0 },
    pricingMethod: 'labor',
    finalize: { deposit: '25%', terms: '' }
  },
  {
    id: 'est-5',
    projectName: 'Whole House Interior',
    status: 'Sent',
    scopeId: 'scope-int',
    customer: {
      id: '4', firstName: 'Alice', lastName: 'Cooper', email: 'alice.c@example.com', phone: '(555) 777-8888',
      billingAddress: '222 Birch Ln', city: 'Decatur', state: 'IL', zip: '62521'
    },
    jobAddress: {
      address: '222 Birch Ln', city: 'Decatur', state: 'IL', zip: '62521', accessCode: ''
    },
    projectInfo: {
      name: 'Whole House Interior', number: 'EST-2024-005', date: new Date().toISOString(), validUntil: new Date(Date.now() + 30 * 86400000).toISOString()
    },
    salesman: MOCK_SALESMEN[2],
    estimateAreas: [
      {
        id: 'area-1',
        name: 'Living Room',
        length: 15, width: 12, height: 9,
        rows: [
          { id: 'r1', item: 'Standard 8ft Walls', productionRateId: 'pr-1', unit: UnitType.SQFT, amount: 486, coats: 2, hours: 3.24, colorNum: '1', customValues: { 'col-prep': 1, 'col-wash': false }, isOptional: false },
          { id: 'r2', item: 'Flat Ceilings', productionRateId: 'pr-2', unit: UnitType.SQFT, amount: 180, coats: 2, hours: 1.5, colorNum: '2', customValues: {}, isOptional: false },
          { id: 'r3', item: 'Baseboards (Standard 4")', productionRateId: 'pr-3', unit: UnitType.LNFT, amount: 54, coats: 2, hours: 0.68, colorNum: '3', customValues: {}, isOptional: false }
        ],
        isOptional: false,
        visibility: {}
      }
    ],
    lineItems: {
      'misc-1': { id: 'misc-1', itemType: 'descriptive', description: 'Setup & Protection', details: 'Cover all floors and furniture with plastic/drop cloths.', quantity: 1, unitPrice: 0, total: 0, isOptional: false, operationType: 'flat' }
    },
    formLayout: ['area-1', 'misc-1'],
    paintColors: [
      { id: 'pc-1', colorCode: '1', colorName: 'Agreeable Gray', brand: 'Sherwin-Williams', productId: 'mat-p1', finish: 'Velvet', area: '', surfaces: [] },
      { id: 'pc-2', colorCode: '2', colorName: 'Pure White', brand: 'Sherwin-Williams', productId: 'mat-p2', finish: 'Flat', area: '', surfaces: [] },
      { id: 'pc-3', colorCode: '3', colorName: 'Extra White', brand: 'Sherwin-Williams', productId: 'mat-p4', finish: 'Semi-Gloss', area: '', surfaces: [] }
    ],
    sundries: [
      { id: 'sun-1', name: 'Blue Painter\'s Tape (1.5")', count: 3, unitPrice: 8.50, total: 25.50 },
      { id: 'sun-2', name: 'Contractor Plastic (9x400)', count: 1, unitPrice: 42.00, total: 42.00 },
      { id: 'sun-3', name: 'Painter\'s Caulk (White)', count: 4, unitPrice: 3.50, total: 14.00 },
      { id: 'sun-4', name: 'Sanding Sponges (Medium)', count: 1, unitPrice: 5.99, total: 5.99 }
    ],
    notes: { customer: '', internal: '' },
    financials: { selectedAccessTierId: '', selectedHeightTierId: '', taxId: 'tax-0', baseGrandTotal: 12500, baseTaxAmount: 0, baseDiscountAmount: 0 },
    pricingMethod: 'labor',
    finalize: { deposit: '20%', terms: '' }
  }
];

// --- MOCK JOBS ---
const fmtKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// Raw calendar-day key, `offset` calendar days from today (covers weekends too).
// Used for the rolling weather forecast so no visible day is blank.
const calKey = (offset: number) => {
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() + offset);
  return fmtKey(d);
};

// Monday (00:00) of the current week — the anchor for all job dates.
const THIS_MONDAY = (() => {
  const d = new Date(); d.setHours(0,0,0,0);
  const dow = d.getDay();                       // 0=Sun..6=Sat
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
})();

// Map a WORKING-DAY index to a calendar Date: 0 = this Monday, 1 = Tue … 4 = Fri,
// 5 = next Monday, -1 = last Friday, etc. Always lands on a weekday. A multi-day
// span whose start/end indices stay within one block of five (start%5 + len ≤ 5)
// never touches a weekend — so jobs are entirely weekend-free.
const wdDate = (workingIdx: number): Date => {
  const week = Math.floor(workingIdx / 5);
  const dow = ((workingIdx % 5) + 5) % 5;
  const d = new Date(THIS_MONDAY);
  d.setDate(d.getDate() + week * 7 + dow);
  return d;
};

// Job day window: 8:00 AM start / 5:00 PM end on the given working-day index.
const jobDay = (workingIdx: number, hour: number) => {
  const d = wdDate(workingIdx); d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

// Working-day key (used for customer-window due dates) — always a weekday.
const dayKey = (workingIdx: number) => fmtKey(wdDate(workingIdx));

// Half-day windows used to split a working day so a crew member's two jobs on the
// same day occupy non-overlapping hours (no time conflict, total ≤ the workday).
const AM = { startTime: '08:00', endTime: '12:00' }; // 4h morning slot
const PM = { startTime: '13:00', endTime: '17:00' }; // 4h afternoon slot
// Build a job's dailyHours map from [working-day index, window] pairs.
const dayWindows = (...entries: [number, { startTime: string; endTime: string }][]) =>
  Object.fromEntries(entries.map(([idx, w]) => [dayKey(idx), w]));

const RAW_JOBS: Job[] = [
  // --- Unscheduled jobs (no startDate): appear in the "Unscheduled Jobs"
  // panel under the board in Job view; drag one onto a day to schedule it. ---
  {
    id: 'job-unsched-1',
    jobNumber: 'JOB-2024-013',
    name: 'Johnson Hallway Refresh',
    clientId: '1',
    estimateId: 'est-1',
    workOrderId: 'wo-3',
    address: '123 Creative Blvd',
    stage: 'Confirmed',
    category: 'Interior',
    crewMemberIds: [],
    dateCreated: new Date().toISOString()
  },
  {
    id: 'job-unsched-2',
    jobNumber: 'JOB-2024-014',
    name: 'Lee Garage & Trim',
    clientId: '2',
    estimateId: 'est-2',
    workOrderId: 'wo-2',
    address: '456 Tech Park',
    stage: 'Confirmed',
    category: 'Exterior',
    crewMemberIds: [],
    dateCreated: new Date().toISOString()
  },
  {
    id: 'job-unsched-3',
    jobNumber: 'JOB-2024-015',
    name: 'Davis Storefront Repaint',
    clientId: '3',
    estimateId: 'est-3',
    address: '500 Market Ave',
    stage: 'Confirmed',
    category: 'Commercial',
    crewMemberIds: [],
    dateCreated: new Date().toISOString()
  },
  {
    id: 'job-2',
    jobNumber: 'JOB-2024-002',
    name: 'Exterior Repaint',
    clientId: '2',
    estimateId: 'est-2',
    workOrderId: 'wo-2',
    invoiceId: 'inv-2',
    address: '456 Tech Park',
    stage: 'In Production',
    category: 'Exterior',
    startDate: jobDay(0, 8),
    endDate: jobDay(2, 12), // multi-day: 3 days (Mon–Wed, no weekend)
    customerWindow: { dueDate: dayKey(3) },
    crewMemberIds: ['cm-3', 'cm-5', 'cm-4'],
    // Same-day different-time showcase: Prep runs Monday MORNING (David + Tom), Paint
    // runs Monday AFTERNOON then Tue–Wed mornings (Sarah + David). David is the one
    // shared member — back-to-back Monday shifts, no overlap. Sarah's Tue–Wed mornings
    // still clear her Downtown Commercial afternoons; Tom's Monday was free.
    dailyHours: dayWindows([1, AM], [2, AM]),
    allocations: [
      { id: 'shift-job-2-prep', name: 'Prep', memberIds: ['cm-3', 'cm-5'],
        startDate: dayKey(0), endDate: dayKey(0), startTime: '08:00', endTime: '12:00' },
      { id: 'shift-job-2-paint', name: 'Paint', memberIds: ['cm-4', 'cm-3'],
        startDate: dayKey(0), endDate: dayKey(2), startTime: '13:00', endTime: '17:00',
        dailyHours: { [dayKey(1)]: AM, [dayKey(2)]: AM } },
    ],
    dateCreated: new Date().toISOString()
  },
  {
    id: 'job-3',
    jobNumber: 'JOB-2026-001',
    name: 'Deck Staining',
    clientId: '3',
    estimateId: 'est-3',
    workOrderId: 'wo-3',
    invoiceId: 'inv-3',
    address: '321 Design St',
    stage: 'Confirmed',
    category: 'Exterior',
    startDate: jobDay(2, 8),
    endDate: jobDay(2, 17),
    crewMemberIds: [],
    dateCreated: new Date().toISOString()
  },
  // NEW JOBS
  {
    id: 'job-4',
    jobNumber: 'JOB-2024-010',
    name: 'Smith Living Room',
    clientId: '1',
    estimateId: 'est-1',
    address: '123 Creative Blvd',
    stage: 'Scheduled',
    category: 'Interior',
    startDate: jobDay(-2, 8),
    endDate: jobDay(-2, 17),
    crewMemberIds: ['cm-1', 'cm-4'],
    dateCreated: new Date().toISOString()
  },
  {
    id: 'job-5',
    jobNumber: 'JOB-2024-011',
    name: 'Miller Exterior',
    clientId: '2',
    estimateId: 'est-2', // Added
    workOrderId: 'wo-2', // 85h exterior work order
    address: '789 Vacation Way',
    stage: 'In Production',
    category: 'Exterior',
    startDate: jobDay(0, 8),
    endDate: jobDay(2, 17), // multi-day: 3 days
    crewMemberIds: ['cm-2'], // Jessica solo — cm-6 stays on Exterior Repaint instead
    // Tue/Wed: morning slot so cm-2 also fits Downtown Commercial (PM) that day.
    dailyHours: dayWindows([1, AM], [2, AM]),
    // Two shifts mirroring the same windows: Prep full day 1, Paint mornings days 2–3 —
    // occupancy identical to the single-job version.
    allocations: [
      { id: 'shift-job-5-prep', name: 'Prep', memberIds: ['cm-2'],
        startDate: dayKey(0), endDate: dayKey(0), startTime: '08:00', endTime: '17:00' },
      { id: 'shift-job-5-paint', name: 'Paint', memberIds: ['cm-2'],
        startDate: dayKey(1), endDate: dayKey(2), startTime: '08:00', endTime: '12:00' },
    ],
    dateCreated: new Date().toISOString()
  },
  {
     id: 'job-6',
     jobNumber: 'JOB-2024-012',
     name: 'Downtown Commercial',
     clientId: '3',
     estimateId: 'est-3',
     workOrderId: 'wo-4', // 132h commercial work order (sized for a 4-day, 4-crew job)
     address: '101 Pine St',
     stage: 'Scheduled',
     category: 'Commercial',
     startDate: jobDay(1, 8),
     endDate: jobDay(4, 17), // multi-day: 4 days
     customerWindow: { dueDate: dayKey(5) },
     crewMemberIds: ['cm-1', 'cm-4', 'cm-6', 'cm-2', 'cm-5'],
     // Afternoon slot all four days: its crew work morning jobs (Exterior Repaint,
     // Miller Exterior, Anderson, Riverside) then move to this one — no hour overlap.
     dailyHours: dayWindows([1, PM], [2, PM], [3, PM], [4, PM]),
     // Two PARALLEL task crews (disjoint members) in the same 1–5 PM window — how a
     // commercial repaint actually staffs. Existing members keep their old afternoons;
     // Tom (cm-5) was idle all week, so adding him introduces no conflicts.
     allocations: [
       { id: 'shift-job-6-spray', name: 'Spray Crew', memberIds: ['cm-6', 'cm-5'],
         startDate: dayKey(1), endDate: dayKey(4), startTime: '13:00', endTime: '17:00',
         // Tom (cm-5) sprays day 2 in the morning instead of with the rest of the crew —
         // the one seeded case where members diverge inside a shift, so the shift card's
         // per-member time rows are visible without setting hours by hand first. AM is
         // the same 4h as PM, so his booked hours are unchanged, and Tom is otherwise
         // idle all week, so the earlier window collides with nothing.
         memberDailyWindows: { 'cm-5': dayWindows([2, AM]) } },
       { id: 'shift-job-6-cutroll', name: 'Cut & Roll', memberIds: ['cm-1', 'cm-4', 'cm-2'],
         startDate: dayKey(1), endDate: dayKey(4), startTime: '13:00', endTime: '17:00' },
     ],
     dateCreated: new Date().toISOString()
  },
  // --- Additional seed jobs so cascade reschedule is observable on a saturated calendar.
  // `win` splits a day into AM/PM where a member also works a neighbouring job so the
  // two never overlap in time (Anderson/Riverside run mornings before Downtown's PM;
  // Foster runs the afternoon while Harborview takes that morning for shared cm-6). ---
  ...([
    { n: 'Anderson Kitchen Cabinets', cat: 'Interior', day: 3, len: 1, crew: ['cm-1'], win: dayWindows([3, AM]) },
    { n: 'Riverside Fence Staining', cat: 'Exterior', day: 4, len: 1, crew: ['cm-6'], win: dayWindows([4, AM]) },
    { n: 'Hillcrest Office Repaint', cat: 'Commercial', day: 5, len: 2, crew: ['cm-2', 'cm-3'] },
    { n: 'Parker Bedroom Suite', cat: 'Interior', day: 6, len: 1, crew: ['cm-4'] },
    { n: 'Lakeview Deck Restoration', cat: 'Exterior', day: 7, len: 2, crew: ['cm-6', 'cm-3'] },
    { n: 'Summit Retail Storefront', cat: 'Commercial', day: 8, len: 1, crew: ['cm-1', 'cm-2'] },
    { n: 'Bennett Hallway & Stairs', cat: 'Interior', day: 9, len: 1, crew: ['cm-4'] },
    { n: 'Oakwood Exterior Trim', cat: 'Exterior', day: 10, len: 1, crew: ['cm-6'] },
    { n: 'Caldwell Living & Dining', cat: 'Interior', day: 11, len: 2, crew: ['cm-1', 'cm-4'] },
    { n: 'Harborview Warehouse', cat: 'Commercial', day: 12, len: 3, crew: ['cm-2', 'cm-3', 'cm-6'], win: dayWindows([13, AM]) },
    { n: 'Foster Garage & Doors', cat: 'Exterior', day: 13, len: 1, crew: ['cm-6'], win: dayWindows([13, PM]) },
    { n: 'Nguyen Master Bath', cat: 'Interior', day: 14, len: 1, crew: ['cm-4'] },
    { n: 'Greenfield Clubhouse', cat: 'Commercial', day: 17, len: 2, crew: ['cm-1', 'cm-2'] },
    { n: 'Whitman Full Exterior', cat: 'Exterior', day: 20, len: 3, crew: ['cm-6', 'cm-3'] },
  ] as { n: string; cat: string; day: number; len: number; crew: string[]; win?: Record<string, { startTime: string; endTime: string }> }[]).map((j, i) => ({
    id: `job-${7 + i}`,
    jobNumber: `JOB-2024-${String(20 + i).padStart(3, '0')}`,
    name: j.n,
    clientId: ['1', '2', '3'][i % 3],
    estimateId: ['est-1', 'est-2', 'est-3'][i % 3],
    address: j.n,
    stage: 'Scheduled' as const,
    category: j.cat,
    startDate: jobDay(j.day, 8),
    endDate: jobDay(j.day + Math.max(0, j.len - 1), 17), // len days (len=1 → single day)
    crewMemberIds: j.crew,
    ...(j.win ? { dailyHours: j.win } : {}),
    dateCreated: new Date().toISOString(),
  }))
];

// Every scheduled job carries at least one shift: materialize a "Crew" allocation
// mirroring each job's dates + per-day windows (no-op for unscheduled jobs and for
// jobs that already define allocations explicitly, e.g. the Prep/Paint showcase).
export const MOCK_JOBS: Job[] = RAW_JOBS.map(ensureJobAllocations);

// Rolling mock forecast covering recent past through a couple weeks ahead, so no
// visible day is blank (real forecasts would come from a provider). The next 7
// days keep a hand-picked demo pattern; surrounding days cycle deterministically.
const WEATHER_CYCLE: WeatherKind[] = ['clear', 'clear', 'rain', 'clear', 'storm', 'clear', 'snow', 'rain', 'clear'];
const NEAR_TERM: WeatherKind[] = ['clear', 'rain', 'clear', 'storm', 'clear', 'clear', 'snow'];

export const MOCK_WEATHER: Record<string, WeatherKind> = (() => {
  const out: Record<string, WeatherKind> = {};
  for (let off = -45; off <= 21; off++) {
    out[calKey(off)] = off >= 0 && off < NEAR_TERM.length
      ? NEAR_TERM[off]
      : WEATHER_CYCLE[((off % WEATHER_CYCLE.length) + WEATHER_CYCLE.length) % WEATHER_CYCLE.length];
  }
  return out;
})();

// --- MOCK APPOINTMENTS ---
export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-1',
    title: 'Estimate: Robert Brown',
    date: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(), // Today 10 AM
    durationMinutes: 90,
    estimatorId: 's1',
    leadId: 'lead-3',
    address: '101 Pine St, Capital City, IL 62701',
    status: 'Scheduled',
    remindersSent: false
  },
  {
    id: 'apt-today-2',
    title: 'Exterior Repaint Production Start',
    date: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(), // Today 8 AM
    durationMinutes: 480,
    estimatorId: 's2',
    address: '456 Tech Park, Innovation City, CA 94000',
    status: 'Scheduled',
    remindersSent: false
  },
  {
    id: 'apt-today-3',
    title: 'Estimate: Alice Cooper',
    date: new Date(new Date().setHours(14, 30, 0, 0)).toISOString(), // Today 2:30 PM
    durationMinutes: 60,
    estimatorId: 's3',
    leadId: 'lead-4',
    address: '222 Birch Ln, Decatur, IL 62521',
    status: 'Scheduled',
    remindersSent: false
  },
  {
      id: 'apt-today-4',
      title: 'Deck Staining Prep',
      date: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(), // Today 11 AM
      durationMinutes: 120,
      estimatorId: 's1',
      address: '321 Design St, Styleville, NY 10002',
      status: 'Scheduled',
      remindersSent: false
  },
  {
    id: 'apt-2',
    title: 'Estimate: Tom Hanks',
    date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(), // Tomorrow
    durationMinutes: 60,
    estimatorId: 's2',
    leadId: 'lead-5',
    address: '333 Elm St, Lincoln, IL 62656',
    status: 'Scheduled',
    remindersSent: false
  }
];
