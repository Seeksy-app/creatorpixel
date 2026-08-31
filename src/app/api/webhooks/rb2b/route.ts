import { createAdminSupabase } from '@/lib/supabase/server';
import { shouldOverwrite, logIdentityEvent, CONFIDENCE } from '@/lib/pdl';
import { extractDomain } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/webhooks/rb2b?secret=...
// Layer 1: RB2B sends LinkedIn profile data when a visitor is identified.
//
// RB2B payload uses Title-Case keys with spaces ("LinkedIn URL", "First Name",
// "Business Email", "Captured URL", ...) and contains no IP address. RB2B has
// no header-auth option — the shared secret must ride in the URL query string.

// Deterministic visitor id so repeat webhooks for the same person update one record
function rb2bVisitorId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h = h | 0; }
  return 'rb2b_' + Math.abs(h).toString(36);
}

export async function POST(request: NextRequest) {
  try {
    // Auth — fail closed: no configured secret means no webhook processing
    const secret = process.env.RB2B_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    const provided = request.nextUrl.searchParams.get('secret')
      || request.headers.get('x-webhook-secret')
      || request.headers.get('authorization')?.replace('Bearer ', '')
      || '';
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // RB2B's native keys, with snake_case fallbacks for manual testing
    const linkedinUrl = body['LinkedIn URL'] || body.linkedin_url || null;
    const firstName = body['First Name'] || body.first_name || null;
    const lastName = body['Last Name'] || body.last_name || null;
    const jobTitle = body['Title'] || body.job_title || null;
    const companyName = body['Company Name'] || body.company_name || null;
    const email = body['Business Email'] || body.email || null;
    const city = body['City'] || body.city || null;
    const state = body['State'] || body.state || null;
    const zipcode = body['Zipcode'] || body.zipcode || null;
    const capturedUrl = body['Captured URL'] || body.captured_url || null;
    const pixelId = body.pixel_id || body.site_id || request.nextUrl.searchParams.get('pixel_id') || null;

    if (!linkedinUrl && !email) {
      return NextResponse.json({ error: 'LinkedIn URL or Business Email required' }, { status: 400 });
    }

    const supabase = createAdminSupabase();
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
    const location = [city, state, zipcode].filter(Boolean).join(', ') || null;

    // Find the creator this webhook belongs to:
    // 1. explicit pixel_id (query param or body)
    // 2. domain of the captured page → pixel_installs
    let creatorId: string | null = null;

    if (pixelId) {
      const { data: creator } = await supabase
        .from('profiles')
        .select('id')
        .eq('pixel_id', pixelId)
        .single();
      creatorId = creator?.id || null;
    }

    if (!creatorId && capturedUrl) {
      const domain = extractDomain(capturedUrl);
      if (domain && domain !== 'unknown') {
        const { data: install } = await supabase
          .from('pixel_installs')
          .select('creator_id')
          .eq('domain', domain)
          .order('last_seen_at', { ascending: false })
          .limit(1)
          .single();
        creatorId = install?.creator_id || null;
      }
    }

    if (!creatorId) {
      return NextResponse.json({ error: 'No matching creator' }, { status: 404 });
    }

    const enrichedFields = {
      email,
      full_name: fullName,
      company: companyName,
      job_title: jobTitle,
      linkedin_url: linkedinUrl,
      identified: true,
      identity_source: 'rb2b',
      confidence_score: CONFIDENCE.rb2b,
      inferred_location: location,
      enriched_at: new Date().toISOString(),
    };

    // Match an existing visitor by email, then by LinkedIn URL
    let visitor: any = null;
    if (email) {
      const { data } = await supabase
        .from('visitors')
        .select('id, visitor_id, email, confidence_score, identity_source, full_name, company')
        .eq('user_id', creatorId)
        .eq('email', email)
        .limit(1)
        .single();
      visitor = data;
    }
    if (!visitor && linkedinUrl) {
      const { data } = await supabase
        .from('visitors')
        .select('id, visitor_id, email, confidence_score, identity_source, full_name, company')
        .eq('user_id', creatorId)
        .eq('linkedin_url', linkedinUrl)
        .limit(1)
        .single();
      visitor = data;
    }

    if (visitor) {
      if (!shouldOverwrite(visitor.identity_source, visitor.confidence_score || 0, 'rb2b')) {
        return NextResponse.json({ status: 'ok', matched: 0, skipped: 'higher confidence exists' });
      }

      const dataBefore = {
        email: visitor.email,
        full_name: visitor.full_name,
        company: visitor.company,
        identity_source: visitor.identity_source,
        confidence_score: visitor.confidence_score,
      };

      await supabase.from('visitors').update({
        ...enrichedFields,
        email: email || visitor.email,
        full_name: fullName || visitor.full_name,
        company: companyName || visitor.company,
      }).eq('id', visitor.id);

      await logIdentityEvent(
        creatorId, visitor.visitor_id, 'rb2b_match',
        CONFIDENCE.rb2b, 'rb2b',
        dataBefore,
        { email, full_name: fullName, company: companyName, linkedin_url: linkedinUrl }
      );

      return NextResponse.json({ status: 'ok', matched: 1 });
    }

    // No existing visitor — create one so the identification isn't lost.
    // Deterministic id keyed on the person, so repeats upsert rather than duplicate.
    const visitorId = rb2bVisitorId(linkedinUrl || email);
    const { data: existing } = await supabase
      .from('visitors')
      .select('id, visitor_id')
      .eq('user_id', creatorId)
      .eq('visitor_id', visitorId)
      .limit(1)
      .single();

    if (existing) {
      await supabase.from('visitors').update(enrichedFields).eq('id', existing.id);
    } else {
      await supabase.from('visitors').insert({
        user_id: creatorId,
        visitor_id: visitorId,
        ...enrichedFields,
        first_page_url: capturedUrl,
        last_page_url: capturedUrl,
        total_clicks: 0,
        total_page_views: 0,
        enrichment_attempts: 0,
      });
    }

    await logIdentityEvent(
      creatorId, visitorId, 'rb2b_match',
      CONFIDENCE.rb2b, 'rb2b',
      null,
      { email, full_name: fullName, company: companyName, linkedin_url: linkedinUrl }
    );

    return NextResponse.json({ status: 'ok', matched: 1, created: !existing });

  } catch (error: any) {
    console.error('RB2B webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
