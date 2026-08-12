import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '../../../data/settings-store';

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ message: 'Settings payload must be an object.' }, { status: 400 });
    }
    const updated = await updateSettings(payload);
    return NextResponse.json({ settings: updated });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to update settings' }, { status: 400 });
  }
}
