import { promises as fs } from 'fs';
import path from 'path';

type ThemeMode = 'auto' | 'light' | 'dark';

export type AppSettings = {
  businessName: string;
  businessLogo: string;
  address: string;
  phoneNumber: string;
  whatsappNumber: string;
  email: string;
  gstNumber: string;
  lowStockThreshold: number;
  totalBoxes: number;
  barsPerBox: number;
  notificationEmail: boolean;
  notificationWhatsApp: boolean;
  invoicePrefix: string;
  currencySymbol: string;
  themeMode: ThemeMode;
  defaultExpenseCategory: string;
  companyTagline: string;
};

const defaultSettings: AppSettings = {
  businessName: '',
  businessLogo: '',
  address: '',
  phoneNumber: '',
  whatsappNumber: '',
  email: '',
  gstNumber: '',
  lowStockThreshold: 20,
  totalBoxes: 200,
  barsPerBox: 2,
  notificationEmail: true,
  notificationWhatsApp: true,
  invoicePrefix: 'INV',
  currencySymbol: '₹',
  themeMode: 'auto',
  defaultExpenseCategory: 'Other Expenses',
  companyTagline: 'Ice production and expense management made easy',
};

const settingsPath = path.join(process.cwd(), 'data', 'settings.json');

async function readSettingsStore() {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2));
    return {};
  }
}

async function writeSettingsStore(settings: Partial<AppSettings>) {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function sanitizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function validateSettings(input: Partial<AppSettings>) {
  const email = sanitizeString(input.email);
  const phoneNumber = sanitizeString(input.phoneNumber);
  const whatsappNumber = sanitizeString(input.whatsappNumber);
  const gstNumber = sanitizeString(input.gstNumber).toUpperCase();
  const businessLogo = sanitizeString(input.businessLogo);

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (phoneNumber && !/^\+?[0-9]{10,15}$/.test(phoneNumber.replace(/[\s-]/g, ''))) throw new Error('Enter a valid mobile number.');
  if (whatsappNumber && !/^\+?[0-9]{10,15}$/.test(whatsappNumber.replace(/[\s-]/g, ''))) throw new Error('Enter a valid WhatsApp number.');
  if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstNumber)) throw new Error('Enter a valid 15-character GST number.');
  if (businessLogo && !/^data:image\/(png|jpeg|webp);base64,/i.test(businessLogo)) throw new Error('Logo must be a PNG, JPEG, or WebP image.');
  if (businessLogo.length > 2_800_000) throw new Error('Logo image must be smaller than 2 MB.');

  for (const [label, value, minimum] of [
    ['Low stock threshold', input.lowStockThreshold, 0],
    ['Total boxes', input.totalBoxes, 1],
    ['Bars per box', input.barsPerBox, 1],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < minimum)) {
      throw new Error(`${label} must be a whole number of at least ${minimum}.`);
    }
  }
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await readSettingsStore();
  return { ...defaultSettings, ...stored } as AppSettings;
}

export async function updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  validateSettings(input);
  const current = await getSettings();
  const next: AppSettings = {
    ...current,
    businessName: sanitizeString(input.businessName, current.businessName),
    businessLogo: sanitizeString(input.businessLogo, current.businessLogo),
    address: sanitizeString(input.address, current.address),
    phoneNumber: sanitizeString(input.phoneNumber, current.phoneNumber),
    whatsappNumber: sanitizeString(input.whatsappNumber, current.whatsappNumber),
    email: sanitizeString(input.email, current.email),
    gstNumber: sanitizeString(input.gstNumber, current.gstNumber).toUpperCase(),
    lowStockThreshold: Math.max(0, parseNumber(input.lowStockThreshold, current.lowStockThreshold)),
    totalBoxes: Math.max(1, parseNumber(input.totalBoxes, current.totalBoxes)),
    barsPerBox: Math.max(1, parseNumber(input.barsPerBox, current.barsPerBox)),
    notificationEmail: parseBoolean(input.notificationEmail, current.notificationEmail),
    notificationWhatsApp: parseBoolean(input.notificationWhatsApp, current.notificationWhatsApp),
    invoicePrefix: sanitizeString(input.invoicePrefix, current.invoicePrefix),
    currencySymbol: sanitizeString(input.currencySymbol, current.currencySymbol),
    themeMode: ['auto', 'light', 'dark'].includes(String(input.themeMode)) ? (input.themeMode as ThemeMode) : current.themeMode,
    defaultExpenseCategory: sanitizeString(input.defaultExpenseCategory, current.defaultExpenseCategory),
    companyTagline: sanitizeString(input.companyTagline, current.companyTagline),
  };

  await writeSettingsStore(next);
  return next;
}
