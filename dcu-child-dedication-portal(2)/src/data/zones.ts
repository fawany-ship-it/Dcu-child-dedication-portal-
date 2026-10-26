import { ZoneInfo } from '../types';

export const ZONES: ZoneInfo[] = [
  {
    name: 'Zone A',
    fellowships: [
      'Doxa',
      'Utukufu',
      'Glory',
      'Judea',
      'Koinonia',
      'Jerusalem',
      'Zion',
      'Favour',
      'Agape'
    ]
  },
  {
    name: 'Zone B',
    fellowships: [
      'Neema',
      'Sifa',
      'Bethsaida',
      'Baraka',
      'Nazareth',
      'Bethel',
      'Kingdom',
      'Rehoboth',
      'Mamlaka',
      'Ebenezer'
    ]
  },
  {
    name: 'Zone C',
    fellowships: [
      'Dominion',
      'Overcomers',
      'Elevation',
      'Genesis',
      'Shammah',
      'Adonai',
      'Shalom',
      'Vision'
    ]
  },
  {
    name: 'Zone D',
    fellowships: [
      'Transformers',
      'Imani',
      'Tumaini',
      'Berea',
      'Theophilus',
      'Pillars',
      'Wisdom',
      'Mt. Moriah'
    ]
  },
  {
    name: 'Zone E',
    fellowships: [
      'Shekinah',
      'Believers',
      'Shiloh',
      'Eden',
      'Peniel',
      'Goshen',
      'Salem',
      'Uhai',
      'Antioch',
      'Macedonia'
    ]
  }
];

// Dedication takes place in a period of 3 months (Quarterly Dedication Services)
export const DEDICATION_SCHEDULE_DATES = [
  {
    date: '2026-11-29',
    label: 'Sunday, 29th November 2026',
    cycle: '4th Quarter Dedication Sunday (Every 3 Months)',
    minister: 'Rev. Emmanuel K. & Pastoral Team'
  },
  {
    date: '2027-02-28',
    label: 'Sunday, 28th February 2027',
    cycle: '1st Quarter Dedication Sunday (Every 3 Months)',
    minister: 'Rev. Emmanuel K. & Pastoral Team'
  },
  {
    date: '2027-05-30',
    label: 'Sunday, 30th May 2027',
    cycle: '2nd Quarter Dedication Sunday (Every 3 Months)',
    minister: 'Rev. Emmanuel K. & Pastoral Team'
  },
  {
    date: '2027-08-29',
    label: 'Sunday, 29th August 2027',
    cycle: '3rd Quarter Dedication Sunday (Every 3 Months)',
    minister: 'Rev. Emmanuel K. & Pastoral Team'
  },
  {
    date: '2027-11-28',
    label: 'Sunday, 28th November 2027',
    cycle: '4th Quarter Dedication Sunday (Every 3 Months)',
    minister: 'Rev. Emmanuel K. & Pastoral Team'
  }
];

// Alias for backwards compatibility
export const MONTHLY_DEDICATION_DATES = DEDICATION_SCHEDULE_DATES;

export const KENYAN_COUNTIES = [
  'Nairobi',
  'Kiambu',
  'Machakos',
  'Kajiado',
  'Nakuru',
  'Mombasa',
  'Kisumu',
  'Uasin Gishu',
  'Murang\'a',
  'Nyeri',
  'Embu',
  'Meru',
  'Kakamega',
  'Kilifi',
  'Kisii',
  'Bungoma',
  'Trans Nzoia',
  'Kericho',
  'Bomet',
  'Kirinyaga',
  'Makueni',
  'Nyandarua',
  'Laikipia',
  'Kitui',
  'Homa Bay',
  'Migori',
  'Siaya',
  'Vihiga',
  'Busia',
  'Nandi',
  'Baringo',
  'Narok',
  'Tharaka-Nithi',
  'Taita-Taveta',
  'Kwale',
  'Garissa',
  'Wajir',
  'Mandera',
  'Marsabit',
  'Isiolo',
  'Turkana',
  'West Pokot',
  'Samburu',
  'Elgeyo-Marakwet',
  'Tana River',
  'Lamu',
  'Nyamira'
];
