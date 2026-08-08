// Per-user integration credentials helper.
// Each app user stores their own Anker SOLIX + Octopus Energy details in a
// UserIntegration record (RLS-locked to them). These helpers resolve the
// *calling user's* credentials so backend functions act only on that user's
// own accounts and devices — never anyone else's.

// Returns the calling user's UserIntegration record, or null if they haven't
// entered their details yet. Runs in user context (RLS-scoped to the caller).
export async function getUserIntegration(base44) {
  const list = await base44.entities.UserIntegration.list("-created_date", 1);
  return list && list[0] ? list[0] : null;
}

function missing(message) {
  const e = new Error(message);
  e.code = "CREDENTIALS_MISSING";
  return e;
}

// Resolves { email, password, country } for the calling user's Anker account.
// Throws a friendly "configure in Settings" error if not set.
export async function getAnkerCreds(base44) {
  const cfg = await getUserIntegration(base44);
  if (!cfg || !cfg.anker_email || !cfg.anker_password || !cfg.anker_country) {
    throw missing("Anker credentials not configured. Add your Anker SOLIX details in Settings.");
  }
  return { email: cfg.anker_email, password: cfg.anker_password, country: cfg.anker_country };
}

// Resolves { apiKey, accountNumber } for the calling user's Octopus Energy account.
export async function getOctopusCreds(base44) {
  const cfg = await getUserIntegration(base44);
  if (!cfg || !cfg.octopus_api_key || !cfg.octopus_account_number) {
    throw missing("Octopus credentials not configured. Add your Octopus Energy details in Settings.");
  }
  return { apiKey: cfg.octopus_api_key, accountNumber: cfg.octopus_account_number };
}