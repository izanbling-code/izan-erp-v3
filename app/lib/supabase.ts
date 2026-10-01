import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tmyxqswvjujniftgpgdf.supabase.co";
const supabaseKey = "sb_publishable_uv401L4KARK0yc-EA9IGqQ_2B4Pv2s3";

export const supabase = createClient(supabaseUrl, supabaseKey);
