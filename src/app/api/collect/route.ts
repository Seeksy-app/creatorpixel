import { createAdminSupabase } from '@/lib/supabase/server';
import { extractDomain } from '@/lib/utils';
import { enrichIP, searchPersonByCompany, shouldOverwrite, logIdentityEvent, CONFIDENCE } from '@/lib/pdl';
import { NextRequest, NextResponse } from 'next/server';

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Rate limiting (in-memory, per-process)
const rateMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW = 3600000;

function isRateLimited(vid: string): boolean {
  const now = Date.now();
  const e = rateMap.get(vid);
  if (!e || now > e.reset) { rateMap.set(vid, { count: 1, reset: now + RATE_WINDOW }); return false; }
  e.count++;
  return e.count > RATE_LIMIT;
}

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateMap.forEach((v, k) => { if (now > v.reset) rateMap.delete(k); });
}, 300000);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

// GET — image pixel fallback
export async function GET(request: NextRequest) {
  const d = request.nextUrl.searchParams.get('d');
  if (d) { try { await processEvent(JSON.parse(d), request); } catch {} }
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: { ...cors, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  });
}

// POST — main collection
export async function POST(request: NextRequest) {
  try {
    // Parse body — sendBeacon sends as text/plain to avoid CORS preflight,
    // so fall back to parsing raw text if .json() fails
    let body: any;
    try {
      body = await request.json();
    } catch {
      const text = await request.text();
      body = JSON.parse(text);
    }

    // Serverless functions freeze after responding, so processing must
    // complete before the response is returned
    await processEvent(body, request);
    return NextResponse.json({ status: 'ok' }, { status: 200, headers: cors });
  } catch (err) {
    console.error('[collect] Failed to parse body');
    return NextResponse.json({ status: 'ok' }, { status: 200, headers: cors });
  }
}

async function processEvent(body: any, request: NextRequest) {
  try {
    const {
      pixel_id, visitor_id, session_id, fingerprint, event_type,
      page_url, page_title, referrer,
      screen_width, screen_height, timezone, language,
      device_type, browser, os,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      email, timestamp,
    } = body;

    if (!pixel_id || !visitor_id) {
      console.warn('[collect] Missing required fields:', { pixel_id: !!pixel_id, visitor_id: !!visitor_id });
      return;
    }
    if (isRateLimited(visitor_id)) {
      console.warn('[collect] Rate limited:', visitor_id);
      return;
    }

    const supabase = createAdminSupabase();

    // 1. Look up creator
    const { data: creator } = await supabase
      .from('profiles')
      .select('id, pixel_id')
      .eq('pixel_id', pixel_id)
      .single();
    if (!creator) {
      console.warn('[collect] Creator not found for pixel_id:', pixel_id);
      return;
    }

    // 2. Extract server-side data
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '0.0.0.0';
    const country = request.headers.get('x-vercel-ip-country') || null;
    const region = request.headers.get('x-vercel-ip-country-region') || null;
    const city = request.headers.get('x-vercel-ip-city') || null;
    const domain = page_url ? extractDomain(page_url) : null;
    const referrerDomain = referrer ? extractDomain(referrer) : null;

    // 3. Insert page view event (created_at uses DB DEFAULT now() — never pass it explicitly)
    const { error: pvError } = await supabase.from('page_view_events').insert({
      creator_id: creator.id,
      visitor_id,
      pixel_id,
      page_url: page_url || null,
      page_title: page_title || null,
      referrer_url: referrer || null,
      referrer_domain: referrerDomain,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      country, region, city,
      device_type: device_type || null,
      browser: browser || null,
      os: os || null,
      screen_width: screen_width ? parseInt(screen_width, 10) : null,
      screen_height: screen_height ? parseInt(screen_height, 10) : null,
      timezone: timezone || null,
      language: language || null,
      fingerprint_hash: fingerprint || null,
      session_id: session_id || null,
      ip_address: ip,
      client_timestamp: timestamp || null,
    });

    if (pvError) console.error('[collect] page_view_events insert failed:', pvError.message);

    // 4. Track pixel install domain
    if (domain) {
      await supabase.rpc('upsert_pixel_install', {
        p_creator_id: creator.id,
        p_pixel_id: pixel_id,
        p_domain: domain,
      });
    }

    // 5. Upsert visitor record
    const { data: existingVisitor } = await supabase
      .from('visitors')
      .select('id, fingerprint_hashes, ip_addresses, total_clicks, total_page_views, first_page_url, confidence_score, identity_source, identified, email, company, enrichment_attempts, inferred_location')
      .eq('user_id', creator.id)
      .eq('visitor_id', visitor_id)
      .single();

    let visitorDbId: string;

    if (existingVisitor) {
      const fps = existingVisitor.fingerprint_hashes || [];
      const ips = existingVisitor.ip_addresses || [];
      if (fingerprint && !fps.includes(fingerprint)) fps.push(fingerprint);
      if (ip && !ips.includes(ip)) ips.push(ip);

      const updates: Record<string, any> = {
        fingerprint_hashes: fps,
        ip_addresses: ips,
        total_page_views: (existingVisitor.total_page_views || 0) + 1,
        last_seen_at: new Date().toISOString(),
        last_page_url: page_url || null,
        inferred_location: city && region ? `${city}, ${region}` : country,
      };

      // Handle identify event (email capture — Layer 3 basic)
      if (event_type === 'identify' && email && shouldOverwrite(existingVisitor.identity_source, existingVisitor.confidence_score || 0, 'email')) {
        updates.email = email;
        updates.identified = true;
        updates.identity_source = 'email';
        updates.confidence_score = CONFIDENCE.email;
      }

      await supabase.from('visitors').update(updates).eq('id', existingVisitor.id);
      visitorDbId = existingVisitor.id;
    } else {
      const newVisitor: Record<string, any> = {
        user_id: creator.id,
        visitor_id,
        fingerprint_hashes: fingerprint ? [fingerprint] : [],
        ip_addresses: ip ? [ip] : [],
        total_clicks: 0,
        total_page_views: 1,
        first_page_url: page_url || null,
        last_page_url: page_url || null,
        inferred_location: city && region ? `${city}, ${region}` : country,
        device_types: device_type ? [device_type] : [],
        enrichment_attempts: 0,
      };

      if (event_type === 'identify' && email) {
        newVisitor.email = email;
        newVisitor.identified = true;
        newVisitor.identity_source = 'email';
        newVisitor.confidence_score = CONFIDENCE.email;
      }

      const { data: inserted } = await supabase.from('visitors').insert(newVisitor).select('id').single();
      visitorDbId = inserted?.id || '';
    }

    // =============================================
    // ASYNC ENRICHMENT — Layer 2 (PDL IP → Company)
    // =============================================
    // Only enrich if:
    // - Not already identified with high confidence
    // - Haven't tried too many times
    // - Has a valid IP
    const currentScore = existingVisitor?.confidence_score || 0;
    const attempts = existingVisitor?.enrichment_attempts || 0;
    const alreadyIdentified = existingVisitor?.identified && currentScore >= CONFIDENCE.pdl_ip_company;

    if (!alreadyIdentified && attempts < 3 && ip && ip !== '0.0.0.0') {
      // Increment attempts counter
      await supabase.from('visitors').update({
        enrichment_attempts: attempts + 1,
      }).eq('id', visitorDbId);

      // Layer 2a: IP → Company
      const ipResult = await enrichIP(ip);
      if (ipResult && ipResult.company_name) {
        const dataBefore = {
          company: existingVisitor?.company || null,
          identity_source: existingVisitor?.identity_source || null,
        };

        if (shouldOverwrite(existingVisitor?.identity_source || null, currentScore, 'pdl_ip_company')) {
          await supabase.from('visitors').update({
            company: ipResult.company_name,
            confidence_score: CONFIDENCE.pdl_ip_company,
            identity_source: 'pdl_ip_company',
            inferred_location: ipResult.city
              ? `${ipResult.city}${ipResult.state ? ', ' + ipResult.state : ''}`
              : existingVisitor?.inferred_location || null,
            enriched_at: new Date().toISOString(),
          }).eq('id', visitorDbId);

          await logIdentityEvent(
            creator.id, visitor_id, 'pdl_ip_company',
            CONFIDENCE.pdl_ip_company, 'pdl_ip_company',
            dataBefore, { company: ipResult.company_name, industry: ipResult.industry }
          );
        }

        // Layer 2b: Company → Person Search
        const personResult = await searchPersonByCompany(ipResult.company_name, city || ipResult.city);
        if (personResult && personResult.full_name) {
          if (shouldOverwrite(existingVisitor?.identity_source || null, currentScore, 'pdl_ip_person')) {
            const personUpdates: Record<string, any> = {
              full_name: personResult.full_name,
              job_title: personResult.job_title,
              linkedin_url: personResult.linkedin_url,
              confidence_score: CONFIDENCE.pdl_ip_person,
              identity_source: 'pdl_ip_person',
              identified: true,
              enriched_at: new Date().toISOString(),
            };
            if (personResult.email) personUpdates.email = personResult.email;

            await supabase.from('visitors').update(personUpdates).eq('id', visitorDbId);

            await logIdentityEvent(
              creator.id, visitor_id, 'pdl_ip_person',
              CONFIDENCE.pdl_ip_person, 'pdl_ip_person',
              dataBefore, { full_name: personResult.full_name, job_title: personResult.job_title }
            );
          }
        }
      }
    }
  } catch (error) {
    console.error('Collect processing error:', error);
  }
}
