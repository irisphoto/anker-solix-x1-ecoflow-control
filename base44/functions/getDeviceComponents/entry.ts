import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";
import { serverForCountry, ankerAuthenticate, ankerRequest, ENDPOINTS } from "../../shared/ankerClient.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const email = secrets.get("ANKER_EMAIL");
    const password = secrets.get("ANKER_PASSWORD");
    const country = secrets.get("ANKER_COUNTRY");
    if (!email || !password || !country) {
      return Response.json({ error: "Anker credentials not configured." }, { status: 400 });
    }

    const base = serverForCountry(country);
    const auth = await ankerAuthenticate(base, email, password, country);

    const sitesData = await ankerRequest(base, ENDPOINTS.siteList, {}, auth, country);
    const siteList = (sitesData.data && sitesData.data.site_list) || [];

    const sites = [];
    for (const s of siteList) {
      const siteId = s.site_id;
      if (!siteId) continue;

      let detail = {};
      let scene = {};
      try {
        const d = await ankerRequest(base, ENDPOINTS.siteDetail, { site_id: siteId, is_check: true }, auth, country);
        detail = (d && d.data) || {};
      } catch (e) { detail = { error: e.message }; }
      try {
        const sc = await ankerRequest(base, ENDPOINTS.sceneInfo, { site_id: siteId }, auth, country);
        scene = (sc && sc.data) || {};
      } catch (e) { scene = { error: e.message }; }

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