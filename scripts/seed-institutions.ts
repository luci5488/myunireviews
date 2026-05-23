/**
 * Seed Australian universities and their departments.
 * Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   npx ts-node scripts/seed-institutions.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Institution {
  name: string;
  short_name: string;
  state_province: string;
  city: string;
  website: string;
  email_domain: string | null;
  allowed_semesters: string[];
  departments: { name: string; code: string }[];
}

const COMMON_DEPARTMENTS = [
  { name: 'Arts and Humanities',                  code: 'ARTS'  },
  { name: 'Business and Economics',               code: 'BUS'   },
  { name: 'Computer Science and IT',              code: 'CSIT'  },
  { name: 'Education',                            code: 'EDU'   },
  { name: 'Engineering',                          code: 'ENG'   },
  { name: 'Health Sciences',                      code: 'HLTH'  },
  { name: 'Law',                                  code: 'LAW'   },
  { name: 'Mathematics and Statistics',           code: 'MATH'  },
  { name: 'Medicine',                             code: 'MED'   },
  { name: 'Psychology',                           code: 'PSYC'  },
  { name: 'Science',                              code: 'SCI'   },
  { name: 'Social Sciences',                      code: 'SOC'   },
];

const S12  = ['Semester 1', 'Semester 2'];
const S12S = ['Semester 1', 'Semester 2', 'Summer Semester'];
const TRI  = ['Trimester 1', 'Trimester 2', 'Trimester 3'];

const INSTITUTIONS: Institution[] = [
  // ── Group of Eight ──────────────────────────────────────────
  {
    name: 'University of Melbourne',
    short_name: 'UniMelb',
    state_province: 'Victoria',
    city: 'Melbourne',
    website: 'https://www.unimelb.edu.au',
    email_domain: 'student.unimelb.edu.au',
    allowed_semesters: S12,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Architecture and Urban Design', code: 'ARCH' },
      { name: 'Fine Arts and Music',           code: 'FAM'  },
      { name: 'Veterinary Science',            code: 'VET'  },
    ],
  },
  {
    name: 'Australian National University',
    short_name: 'ANU',
    state_province: 'Australian Capital Territory',
    city: 'Canberra',
    website: 'https://www.anu.edu.au',
    email_domain: 'anu.edu.au',
    allowed_semesters: ['Semester 1', 'Semester 2', 'Summer Session'],
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Asia-Pacific Affairs',          code: 'APA'  },
      { name: 'Archaeology and Anthropology',  code: 'ANTH' },
      { name: 'Philosophy',                    code: 'PHIL' },
    ],
  },
  {
    name: 'University of Sydney',
    short_name: 'USYD',
    state_province: 'New South Wales',
    city: 'Sydney',
    website: 'https://www.sydney.edu.au',
    email_domain: 'uni.sydney.edu.au',
    allowed_semesters: S12,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Architecture, Design and Planning', code: 'ARCH' },
      { name: 'Dentistry',                         code: 'DENT' },
      { name: 'Pharmacy',                          code: 'PHRM' },
    ],
  },
  {
    name: 'University of Queensland',
    short_name: 'UQ',
    state_province: 'Queensland',
    city: 'Brisbane',
    website: 'https://www.uq.edu.au',
    email_domain: 'uq.net.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Agriculture and Food Sciences', code: 'AGRI' },
      { name: 'Dentistry',                     code: 'DENT' },
      { name: 'Pharmacy',                      code: 'PHRM' },
    ],
  },
  {
    name: 'University of Western Australia',
    short_name: 'UWA',
    state_province: 'Western Australia',
    city: 'Perth',
    website: 'https://www.uwa.edu.au',
    email_domain: 'student.uwa.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'University of Adelaide',
    short_name: 'UoA',
    state_province: 'South Australia',
    city: 'Adelaide',
    website: 'https://www.adelaide.edu.au',
    email_domain: 'student.adelaide.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Agriculture, Food and Wine', code: 'AGRI' },
      { name: 'Dentistry',                  code: 'DENT' },
    ],
  },
  {
    name: 'Monash University',
    short_name: 'Monash',
    state_province: 'Victoria',
    city: 'Melbourne',
    website: 'https://www.monash.edu',
    email_domain: 'student.monash.edu',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Art, Design and Architecture', code: 'ADA'  },
      { name: 'Pharmacy and Pharmaceutical Sciences', code: 'PHRM' },
    ],
  },
  {
    name: 'UNSW Sydney',
    short_name: 'UNSW',
    state_province: 'New South Wales',
    city: 'Sydney',
    website: 'https://www.unsw.edu.au',
    email_domain: 'ad.unsw.edu.au',
    allowed_semesters: TRI,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Art and Design',       code: 'ART'  },
      { name: 'Built Environment',    code: 'BENV' },
      { name: 'Mining Engineering',   code: 'MINE' },
    ],
  },

  // ── ATN (Australian Technology Network) ─────────────────────
  {
    name: 'RMIT University',
    short_name: 'RMIT',
    state_province: 'Victoria',
    city: 'Melbourne',
    website: 'https://www.rmit.edu.au',
    email_domain: 'student.rmit.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Art and Design',       code: 'ART'  },
      { name: 'Architecture',         code: 'ARCH' },
      { name: 'Media and Communication', code: 'MED' },
    ],
  },
  {
    name: 'Curtin University',
    short_name: 'Curtin',
    state_province: 'Western Australia',
    city: 'Perth',
    website: 'https://www.curtin.edu.au',
    email_domain: 'postoffice.curtin.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Architecture and Construction', code: 'ARCH' },
      { name: 'Media, Creative Arts and Design', code: 'MCAD' },
      { name: 'Mining Engineering',            code: 'MINE' },
    ],
  },
  {
    name: 'University of Technology Sydney',
    short_name: 'UTS',
    state_province: 'New South Wales',
    city: 'Sydney',
    website: 'https://www.uts.edu.au',
    email_domain: 'student.uts.edu.au',
    allowed_semesters: ['Autumn', 'Spring', 'Summer'],
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Design, Architecture and Building', code: 'DAB' },
      { name: 'Communication',                     code: 'COM' },
    ],
  },
  {
    name: 'Queensland University of Technology',
    short_name: 'QUT',
    state_province: 'Queensland',
    city: 'Brisbane',
    website: 'https://www.qut.edu.au',
    email_domain: 'connect.qut.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Creative Industries',  code: 'CRI'  },
      { name: 'Built Environment',    code: 'BENV' },
    ],
  },
  {
    name: 'University of South Australia',
    short_name: 'UniSA',
    state_province: 'South Australia',
    city: 'Adelaide',
    website: 'https://www.unisa.edu.au',
    email_domain: 'mymail.unisa.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },

  // ── Other major universities ─────────────────────────────────
  {
    name: 'Macquarie University',
    short_name: 'MQ',
    state_province: 'New South Wales',
    city: 'Sydney',
    website: 'https://www.mq.edu.au',
    email_domain: 'students.mq.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'University of Wollongong',
    short_name: 'UOW',
    state_province: 'New South Wales',
    city: 'Wollongong',
    website: 'https://www.uow.edu.au',
    email_domain: 'uowmail.edu.au',
    allowed_semesters: ['Autumn', 'Spring', 'Summer'],
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'University of Newcastle',
    short_name: 'UON',
    state_province: 'New South Wales',
    city: 'Newcastle',
    website: 'https://www.newcastle.edu.au',
    email_domain: 'uon.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'Deakin University',
    short_name: 'Deakin',
    state_province: 'Victoria',
    city: 'Geelong',
    website: 'https://www.deakin.edu.au',
    email_domain: 'deakin.edu.au',
    allowed_semesters: TRI,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'Swinburne University of Technology',
    short_name: 'Swinburne',
    state_province: 'Victoria',
    city: 'Melbourne',
    website: 'https://www.swinburne.edu.au',
    email_domain: 'student.swinburne.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Design',         code: 'DES' },
      { name: 'Film and TV',    code: 'FTV' },
    ],
  },
  {
    name: 'La Trobe University',
    short_name: 'LaTrobe',
    state_province: 'Victoria',
    city: 'Melbourne',
    website: 'https://www.latrobe.edu.au',
    email_domain: 'students.latrobe.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'Flinders University',
    short_name: 'Flinders',
    state_province: 'South Australia',
    city: 'Adelaide',
    website: 'https://www.flinders.edu.au',
    email_domain: 'flinders.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'Griffith University',
    short_name: 'Griffith',
    state_province: 'Queensland',
    city: 'Brisbane',
    website: 'https://www.griffith.edu.au',
    email_domain: 'griffithuni.edu.au',
    allowed_semesters: TRI,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'James Cook University',
    short_name: 'JCU',
    state_province: 'Queensland',
    city: 'Townsville',
    website: 'https://www.jcu.edu.au',
    email_domain: 'my.jcu.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Marine and Tropical Sciences', code: 'MTS' },
    ],
  },
  {
    name: 'Murdoch University',
    short_name: 'Murdoch',
    state_province: 'Western Australia',
    city: 'Perth',
    website: 'https://www.murdoch.edu.au',
    email_domain: 'student.murdoch.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'Western Sydney University',
    short_name: 'WSU',
    state_province: 'New South Wales',
    city: 'Penrith',
    website: 'https://www.westernsydney.edu.au',
    email_domain: 'student.westernsydney.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'Australian Catholic University',
    short_name: 'ACU',
    state_province: 'New South Wales',
    city: 'Sydney',
    website: 'https://www.acu.edu.au',
    email_domain: 'myacu.edu.au',
    allowed_semesters: S12S,
    departments: [
      { name: 'Arts and Education',          code: 'AE'   },
      { name: 'Business',                    code: 'BUS'  },
      { name: 'Health Sciences',             code: 'HLTH' },
      { name: 'Law and Governance',          code: 'LAW'  },
      { name: 'Philosophy and Theology',     code: 'PHIL' },
      { name: 'Nursing, Midwifery and Paramedicine', code: 'NMP' },
    ],
  },
  {
    name: 'Bond University',
    short_name: 'Bond',
    state_province: 'Queensland',
    city: 'Gold Coast',
    website: 'https://www.bond.edu.au',
    email_domain: 'student.bond.edu.au',
    allowed_semesters: ['January', 'May', 'September'],
    departments: [
      { name: 'Business',                  code: 'BUS'  },
      { name: 'Law',                       code: 'LAW'  },
      { name: 'Health Sciences and Medicine', code: 'HLTH' },
      { name: 'Humanities and Social Sciences', code: 'HSS' },
      { name: 'Information Technology',    code: 'IT'   },
    ],
  },
  {
    name: 'Charles Darwin University',
    short_name: 'CDU',
    state_province: 'Northern Territory',
    city: 'Darwin',
    website: 'https://www.cdu.edu.au',
    email_domain: 'students.cdu.edu.au',
    allowed_semesters: S12S,
    departments: [...COMMON_DEPARTMENTS],
  },
  {
    name: 'University of Tasmania',
    short_name: 'UTAS',
    state_province: 'Tasmania',
    city: 'Hobart',
    website: 'https://www.utas.edu.au',
    email_domain: 'utas.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Antarctic and Marine Sciences', code: 'AMS' },
    ],
  },
  {
    name: 'University of New England',
    short_name: 'UNE',
    state_province: 'New South Wales',
    city: 'Armidale',
    website: 'https://www.une.edu.au',
    email_domain: 'myune.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Rural Medicine', code: 'RMED' },
    ],
  },
  {
    name: 'Charles Sturt University',
    short_name: 'CSU',
    state_province: 'New South Wales',
    city: 'Wagga Wagga',
    website: 'https://www.csu.edu.au',
    email_domain: 'csu.edu.au',
    allowed_semesters: S12S,
    departments: [
      ...COMMON_DEPARTMENTS,
      { name: 'Agriculture and Environmental Sciences', code: 'AGRI' },
      { name: 'Policing, Intelligence and Counter Terrorism', code: 'PICT' },
    ],
  },
  {
    name: 'Victoria University',
    short_name: 'VU',
    state_province: 'Victoria',
    city: 'Melbourne',
    website: 'https://www.vu.edu.au',
    email_domain: 'live.vu.edu.au',
    allowed_semesters: TRI,
    departments: [...COMMON_DEPARTMENTS],
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let instInserted = 0;
    let deptInserted = 0;

    for (const inst of INSTITUTIONS) {
      const res = await client.query<{ id: number }>(
        `INSERT INTO institutions (name, short_name, country, state_province, city, website, email_domain, allowed_semesters, is_active)
         VALUES ($1, $2, 'Australia', $3, $4, $5, $6, $7, true)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [inst.name, inst.short_name, inst.state_province, inst.city, inst.website, inst.email_domain, inst.allowed_semesters],
      );

      if (res.rows.length === 0) {
        // Already exists — fetch its id so we can still upsert departments
        const existing = await client.query<{ id: number }>(
          'SELECT id FROM institutions WHERE name = $1', [inst.name],
        );
        if (existing.rows.length === 0) continue;
        var instId = existing.rows[0].id;
      } else {
        instInserted++;
        var instId = res.rows[0].id;
      }

      for (const dept of inst.departments) {
        const dRes = await client.query(
          `INSERT INTO departments (institution_id, name, code)
           VALUES ($1, $2, $3)
           ON CONFLICT (institution_id, code) DO NOTHING`,
          [instId, dept.name, dept.code],
        );
        deptInserted += dRes.rowCount ?? 0;
      }
    }

    await client.query('COMMIT');
    console.log(`✅  Seeded ${instInserted} institutions, ${deptInserted} departments`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed — rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
