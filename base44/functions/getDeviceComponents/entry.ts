import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";
import { getAnkerCreds } from "../../shared/userIntegration.ts";

// Lists the physical device components (batteries, inverters, EV charger) for
// the calling user's own Anker SOLIX sites, using their own credentials.

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    let creds;
    try { creds = await getAnkerCreds(base44); }
    catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
    const { email, password, country } = creds;

    const base = serverForCountry(country);
    const auth = await ankerAuthenticate(base, email, password, country);

    const sitesData = await ankerRequest(base, ENDPOINTS.siteList, {}, auth, country);
    const siteList = (sitesData.data && sitesData.data.site_list) || [];

    const sites = [];
    for (const s of siteList) {
      const siteId = s.site_id;
      if (!siteId) continue;

      let detail = {};
      try {
        const d = await ankerRequest(base, ENDPOINTS.siteDetail, { site_id: siteId, is_check: true }, auth, country);
        detail = (d && d.data) || {};
      } catch (e) { detail = { error: e.message }; }

      const devices = (detail.site_info && detail.site_info.site_device_list) || [];
      sites.push({
        site_id: siteId,
        site_name: s.site_name,
        current_models: (detail.site_info && detail.site_info.current_site_device_models) || [],
        devices: devices.map((d) => ({
          model: d.device_model,
          sn: d.device_sn,
          name: d.device_name,
          type: d.device_type,
          status: d.status,
          img: d.device_img,
        })),
      });
    }

    return Response.json({ success: true, site_count: siteList.length, sites });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}